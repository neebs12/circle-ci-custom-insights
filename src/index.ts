import axios, { AxiosResponse } from 'axios';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

// Environment variables
const API_TOKEN = process.env.API_TOKEN;
const ORG_SLUG = process.env.ORG_SLUG;
const PROJECT_NAME = process.env.PROJECT_NAME;

// Interfaces
interface CircleCIResponse {
  next_page_token: string | null;
  items: Pipeline[];
}

interface Pipeline {
  id: string;
  state: string;
  number: number;
  created_at: string;
  trigger: {
    received_at: string;
    type: string;
    actor: {
      login: string;
      avatar_url: string;
    };
  };
  vcs: {
    branch: string;
    commit: {
      subject: string;
    };
  };
}

interface Workflow {
  pipeline_id: string;
  id: string;
  name: string;
  project_slug: string;
  status: string;
  started_by: string;
  pipeline_number: number;
  created_at: string;
  stopped_at: string;
  branch?: string; // Added branch info
}

interface WorkflowResponse {
  next_page_token: string | null;
  items: Workflow[];
}

interface PipelineSummary {
  id: string;
  branch: string;
  created_at: string;
}

interface FetchOptions {
  startDate: Date;
  endDate: Date;
  maxItems?: number;
}

async function fetchAllPipelines(options: FetchOptions): Promise<Pipeline[]> {
  if (!API_TOKEN || !ORG_SLUG || !PROJECT_NAME) {
    throw new Error('Required environment variables are not set. Please check your .env file.');
  }

  const allPipelines: Pipeline[] = [];
  let nextPageToken: string | null = null;
  
  do {
    try {
      const url: string = `https://circleci.com/api/v2/project/${ORG_SLUG}/${PROJECT_NAME}/pipeline${nextPageToken ? `?page-token=${nextPageToken}` : ''}`;
      const response: AxiosResponse<CircleCIResponse> = await axios.get(url, {
        headers: {
          'Circle-Token': API_TOKEN
        }
      });

      const { items, next_page_token }: CircleCIResponse = response.data;
      
      // Filter items by date range
      const filteredItems = items.filter(pipeline => {
        const pipelineDate = new Date(pipeline.created_at);
        return pipelineDate >= options.startDate && pipelineDate <= options.endDate;
      });

      allPipelines.push(...filteredItems);
      nextPageToken = next_page_token;

      // Check if we've reached the maximum desired items
      if (options.maxItems && allPipelines.length >= options.maxItems) {
        allPipelines.splice(options.maxItems);
        break;
      }

      // If we get an empty next_page_token or the last item is before our start date, stop paginating
      if (!next_page_token || new Date(items[items.length - 1].created_at) < options.startDate) {
        break;
      }

    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('API Error:', error.response?.data || error.message);
      } else {
        console.error('Error:', error);
      }
      throw error;
    }
  } while (nextPageToken);

  return allPipelines;
}

async function fetchWorkflowsForPipeline(pipelineId: string, branch: string): Promise<Workflow[]> {
  try {
    const url = `https://circleci.com/api/v2/pipeline/${pipelineId}/workflow`;
    const response: AxiosResponse<WorkflowResponse> = await axios.get(url, {
      headers: {
        'Circle-Token': API_TOKEN
      }
    });

    // Add branch information to each workflow
    return response.data.items.map(workflow => ({
      ...workflow,
      branch
    }));
  } catch (error) {
    console.error(`Error fetching workflows for pipeline ${pipelineId}:`, error);
    return [];
  }
}

async function fetchAllWorkflows(): Promise<void> {
  try {
    // Read pipelines from file
    const pipelinesPath = path.join(process.cwd(), 'outputs', 'pipelines.json');
    const pipelinesData = await fs.readFile(pipelinesPath, 'utf-8');
    const pipelines: Pipeline[] = JSON.parse(pipelinesData);

    console.log(`Fetching workflows for ${pipelines.length} pipelines...`);

    const allWorkflows: Workflow[] = [];
    let completedPipelines = 0;

    // Process pipelines in batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < pipelines.length; i += batchSize) {
      const batch = pipelines.slice(i, i + batchSize);
      const workflowPromises = batch.map(pipeline => 
        fetchWorkflowsForPipeline(pipeline.id, pipeline.vcs?.branch || '')
      );

      const workflowResults = await Promise.all(workflowPromises);
      workflowResults.forEach(workflows => allWorkflows.push(...workflows));

      completedPipelines += batch.length;
      console.log(`Progress: ${completedPipelines}/${pipelines.length} pipelines processed`);
    }

    // Save workflows to file
    const workflowsPath = path.join(process.cwd(), 'outputs', 'workflows.json');
    await fs.writeFile(workflowsPath, JSON.stringify(allWorkflows, null, 2));
    console.log(`Workflow data saved to outputs/workflows.json`);
    console.log(`Total workflows fetched: ${allWorkflows.length}`);

  } catch (error) {
    console.error('Error processing workflows:', error);
    throw error;
  }
}

async function savePipelinesToFile(pipelines: Pipeline[], filename: string): Promise<void> {
  const outputPath = path.join(process.cwd(), 'outputs', filename);
  await fs.writeFile(outputPath, JSON.stringify(pipelines, null, 2));
  console.log(`Pipeline data saved to outputs/${filename}`);
}

async function main() {
  try {
    // Example usage: fetch pipelines for the last 7 days with a maximum of 100 items
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const options: FetchOptions = {
      startDate,
      endDate,
      maxItems: 100
    };

    const pipelines = await fetchAllPipelines(options);
    
    console.log(`Found ${pipelines.length} pipelines between ${startDate.toISOString()} and ${endDate.toISOString()}`);
    
    // Save full pipeline data to JSON file
    await savePipelinesToFile(pipelines, 'pipelines.json');
    
    // Create simplified pipeline summaries
    const pipelineSummaries: PipelineSummary[] = pipelines.map(pipeline => ({
      id: pipeline.id,
      branch: pipeline.vcs?.branch || '',
      created_at: pipeline.created_at
    }));

    console.log('\nPipeline Summaries:');
    console.log(JSON.stringify(pipelineSummaries, null, 2));

    // Fetch and save workflows
    console.log('\nFetching workflows...');
    await fetchAllWorkflows();

  } catch (error) {
    console.error('Failed to fetch pipelines:', error);
  }
}

// Only run if this file is being run directly
if (require.main === module) {
  main();
}
