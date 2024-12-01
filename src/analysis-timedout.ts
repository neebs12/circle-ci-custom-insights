import fs from 'fs/promises';
import path from 'path';
import { Job, JobDetail, TimeoutAnalysis, TimeoutAnalysisResult, TestFeatureAnalysis } from './types';
import { createClassification, getSecondToLastMessage } from './analysis-scripts/classification';
import { buildTree } from './analysis-scripts/tree-builder';
import { updateTestFeatureAnalysis, logTestFeatureAnalysis } from './analysis-scripts/test-features';
import { ensureAnalysisDir, clearAnalysisDir, logAnalysisError, saveAnalysisResult } from './analysis-scripts/fs-utils';
import { generateTreeYaml } from './analysis-scripts/yaml-generator';

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

        // Update test_features analysis
        updateTestFeatureAnalysis(testFeatureAnalysis, jobFileName, jobDetail);

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
    await saveAnalysisResult(analysisDir, 'timedout.json', { entries: timeoutEntries });
    console.log('Entries saved, building tree...');

    // Read the file back
    const savedData = JSON.parse(await fs.readFile(path.join(analysisDir, 'timedout.json'), 'utf-8'));
    
    // Build the tree
    console.log('Building classification tree...');
    const tree = buildTree(savedData.entries);

    // Save the complete result with both entries and tree
    console.log('Saving complete analysis with tree...');
    const completeResult: TimeoutAnalysisResult = {
      entries: savedData.entries,
      tree: tree
    };
    await saveAnalysisResult(analysisDir, 'timedout.json', completeResult);

    // Generate YAML from tree
    console.log('Generating tree YAML...');
    await generateTreeYaml(analysisDir, completeResult);

    console.log('\nAnalysis complete:');
    console.log(`- Total jobs: ${jobs.length}`);
    console.log(`- Successfully processed: ${processedJobs}`);
    console.log(`- Skipped/Failed: ${skippedJobs}`);
    console.log(`- Found ${timeoutEntries.length} timed out actions`);

    // Log test_features analysis
    logTestFeatureAnalysis(testFeatureAnalysis);

    console.log('\nResults saved to:');
    console.log('- outputs/analysis/timedout.json');
    console.log('- outputs/analysis/timedout-tree.yaml');

  } catch (error) {
    console.error('Analysis failed:', error);
    await logAnalysisError(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

// Execute the analysis
analyzeTimeouts();
