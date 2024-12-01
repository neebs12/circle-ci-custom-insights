import fs from 'fs/promises';
import path from 'path';
import { Job, JobDetail, TimeoutAnalysis, TimeoutAnalysisResult, TreeNode } from './types';

interface StatusCount {
  total: number;
  [key: string]: number;  // For dynamic status counts
}

interface TestFeatureAnalysis {
  [filename: string]: StatusCount;
}

async function ensureAnalysisDir(): Promise<string> {
  const analysisDir = path.join(process.cwd(), 'outputs', 'analysis');
  await fs.mkdir(analysisDir, { recursive: true });
  return analysisDir;
}

async function clearAnalysisDir(analysisDir: string): Promise<void> {
  try {
    console.log('Clearing analysis directory...');
    const files = await fs.readdir(analysisDir);
    for (const file of files) {
      await fs.unlink(path.join(analysisDir, file));
    }
    console.log('Analysis directory cleared');
  } catch (error: any) {
    // If directory doesn't exist or is already empty, continue
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function logAnalysisError(message: string): Promise<void> {
  const analysisDir = await ensureAnalysisDir();
  const logPath = path.join(analysisDir, 'analysis.log');
  const timestamp = new Date().toISOString();
  await fs.appendFile(logPath, `${timestamp}: ${message}\n`);
}

function getSecondToLastMessage(outputs: any[]): string | null {
  if (outputs && outputs.length >= 2) {
    return outputs[outputs.length - 2].message;
  }
  return null;
}

function stripAnsiCodes(str: string): string {
  return str.replace(/\u001b\[\d+m/g, '');
}

function getLeadingSpaces(str: string): number {
  const match = str.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

function processClassification(lines: string[]): string[] {
  if (lines.length === 0) return [];

  const result: string[] = [lines[0]]; // Always keep the first line

  // Process remaining lines
  for (let i = 1; i < lines.length; i++) {
    const currentLine = lines[i];
    const currentSpaces = getLeadingSpaces(currentLine);
    
    // Check if there's any later line with >= 2 spaces AND <= current spaces
    let shouldRemove = false;
    for (let j = i + 1; j < lines.length; j++) {
      const laterSpaces = getLeadingSpaces(lines[j]);
      if (laterSpaces >= 2 && laterSpaces <= currentSpaces) {
        shouldRemove = true;
        break;
      }
    }
    
    // Keep the line only if we didn't find a reason to remove it
    if (!shouldRemove) {
      result.push(currentLine);
    }
  }

  return result;
}

interface ClassificationResult {
  unprocessed: string[];
  processed: string[];
}

function createClassification(message: string): ClassificationResult {
  // Split the message by \r\n
  const lines = message.split('\r\n');
  
  // Work backwards through the array to find the first string that starts with a letter
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    // Don't trim - check the actual first character after removing ANSI codes
    const cleanLine = stripAnsiCodes(line);
    if (cleanLine && /^[a-zA-Z]/.test(cleanLine)) {
      // Get the unprocessed array (with ANSI codes)
      const unprocessed = lines.slice(i).filter(line => line !== '');
      // Get the processed array (ANSI codes stripped and classification processed)
      const stripped = unprocessed.map(line => stripAnsiCodes(line));
      const processed = processClassification(stripped);
      
      return {
        unprocessed,
        processed
      };
    }
  }
  
  return {
    unprocessed: [],
    processed: []
  };
}

function buildTree(entries: TimeoutAnalysis[]): { [key: string]: TreeNode } {
  const tree: { [key: string]: TreeNode } = {};

  for (const entry of entries) {
    const classification = entry.classification;
    if (classification.length === 0) continue;

    // First element is always the head node
    const headNode = classification[0];
    if (!tree[headNode]) {
      tree[headNode] = { count: 0, children: {} };
    }
    tree[headNode].count++;

    // Rest of the elements are branches under that head
    let currentNode = tree[headNode].children;
    for (let i = 1; i < classification.length; i++) {
      const branch = classification[i];
      if (!currentNode[branch]) {
        currentNode[branch] = { count: 0, children: {} };
      }
      currentNode[branch].count++;
      currentNode = currentNode[branch].children;
    }
  }

  return tree;
}

function getBaseFilename(filename: string): string {
  // Remove the job number prefix (everything before and including the first hyphen)
  return filename.replace(/^\d+-/, '');
}

async function analyzeTimeouts(): Promise<void> {
  try {
    console.log('Starting timeout analysis...');

    // Ensure and clear analysis directory
    const analysisDir = await ensureAnalysisDir();
    await clearAnalysisDir(analysisDir);

    // Read jobs.json
    console.log('Reading jobs.json...');
    const jobsPath = path.join(process.cwd(), 'outputs', 'jobs.json');
    const jobsData = await fs.readFile(jobsPath, 'utf-8');
    const jobs: Job[] = JSON.parse(jobsData);
    console.log(`Found ${jobs.length} jobs to analyze`);

    // Read workflows.json for workflow information
    console.log('Reading workflows.json...');
    const workflowsPath = path.join(process.cwd(), 'outputs', 'workflows.json');
    const workflowsData = await fs.readFile(workflowsPath, 'utf-8');
    const workflows = JSON.parse(workflowsData);
    console.log(`Found ${workflows.length} workflows`);

    const timeoutEntries: TimeoutAnalysis[] = [];
    let processedJobs = 0;
    let skippedJobs = 0;
    let lastProgressUpdate = 0;

    // Track test_features analysis
    const testFeatureAnalysis: TestFeatureAnalysis = {};

    // Process each job
    console.log('Processing jobs...');
    for (const job of jobs) {
      // Log progress every 10%
      const progress = Math.floor((processedJobs / jobs.length) * 100);
      if (progress >= lastProgressUpdate + 10) {
        console.log(`Progress: ${progress}% (${processedJobs}/${jobs.length} jobs processed)`);
        console.log(`Current timeout entries found: ${timeoutEntries.length}`);
        lastProgressUpdate = progress;
      }

      if (!job.job_number || !job.name) {
        await logAnalysisError(`Skipping job with missing data - ID: ${job.id}, Number: ${job.job_number}, Name: ${job.name}`);
        skippedJobs++;
        continue;
      }

      try {
        // Construct job detail file path
        const jobFileName = `${job.job_number}-${job.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.json`;
        const jobDetailPath = path.join(process.cwd(), 'outputs', 'jobs', jobFileName);

        // Check if file exists before trying to read it
        try {
          await fs.access(jobDetailPath);
        } catch {
          await logAnalysisError(`Job detail file not found: ${jobFileName}`);
          skippedJobs++;
          continue;
        }

        // Read job detail file
        const jobDetailData = await fs.readFile(jobDetailPath, 'utf-8');
        const jobDetail: JobDetail = JSON.parse(jobDetailData);

        // Track test_features jobs
        if (jobFileName.match(/.*test_features\.json$/)) {
          const baseFilename = getBaseFilename(jobFileName);
          if (!testFeatureAnalysis[baseFilename]) {
            testFeatureAnalysis[baseFilename] = { total: 0 };
          }
          testFeatureAnalysis[baseFilename].total++;
          
          const status = jobDetail.status;
          if (!testFeatureAnalysis[baseFilename][status]) {
            testFeatureAnalysis[baseFilename][status] = 0;
          }
          testFeatureAnalysis[baseFilename][status]++;
        }

        // Find the workflow for this job
        const workflow = workflows.find((w: any) => w.id === job.id.split('/')[0]);
        const branch = workflow?.branch || jobDetail.branch;

        // Process each step and action
        jobDetail.steps.forEach(step => {
          step.actions.forEach(action => {
            if (action.timedout === true && action._output && Array.isArray(action._output)) {
              const message = getSecondToLastMessage(action._output);
              if (message) {
                const classification = createClassification(message);
                timeoutEntries.push({
                  start_time: action.start_time,
                  workflow_id: workflow?.id || 'unknown',
                  branch: branch || 'unknown',
                  job_id: job.id,
                  job_name: job.name,
                  index: action.index,
                  message: message,
                  unprocessed_classification: classification.unprocessed,
                  classification: classification.processed,
                  build_url: jobDetail.build_url
                });
              }
            }
          });
        });

        processedJobs++;
      } catch (error) {
        await logAnalysisError(`Failed to process job ${job.job_number} (${job.name}): ${error instanceof Error ? error.message : 'Unknown error'}`);
        skippedJobs++;
      }
    }

    // First, save just the entries
    console.log('Saving entries...');
    const analysisPath = path.join(analysisDir, 'timedout.json');
    await fs.writeFile(analysisPath, JSON.stringify({ entries: timeoutEntries }, null, 2));
    console.log('Entries saved, building tree...');

    // Read the file back
    const savedData = JSON.parse(await fs.readFile(analysisPath, 'utf-8'));
    
    // Build the tree
    console.log('Building classification tree...');
    const tree = buildTree(savedData.entries);

    // Save the complete result with both entries and tree
    console.log('Saving complete analysis with tree...');
    const completeResult: TimeoutAnalysisResult = {
      entries: savedData.entries,
      tree: tree
    };
    await fs.writeFile(analysisPath, JSON.stringify(completeResult, null, 2));

    console.log('\nAnalysis complete:');
    console.log(`- Total jobs: ${jobs.length}`);
    console.log(`- Successfully processed: ${processedJobs}`);
    console.log(`- Skipped/Failed: ${skippedJobs}`);
    console.log(`- Found ${timeoutEntries.length} timed out actions`);

    console.log('\nAnalysis of test_features jobs:');
    Object.entries(testFeatureAnalysis).forEach(([filename, counts]) => {
      console.log(`- ${filename}`);
      console.log(`  - Total: ${counts.total}`);
      Object.entries(counts).forEach(([status, count]) => {
        if (status !== 'total') {
          console.log(`  - ${status}: ${count}`);
        }
      });
    });

    console.log('\nResults saved to outputs/analysis/timedout.json');

  } catch (error) {
    console.error('Analysis failed:', error);
    await logAnalysisError(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

// Execute the analysis
analyzeTimeouts();
