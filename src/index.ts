import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { PipelinesService } from './services/PipelinesService';
import { WorkflowsService } from './services/WorkflowsService';
import { JobsService } from './services/JobsService';
import { Pipeline, Workflow } from './types';

// Load environment variables from .env file
dotenv.config();

// Environment variables
const API_TOKEN = process.env.API_TOKEN;
const ORG_SLUG = process.env.ORG_SLUG;
const PROJECT_NAME = process.env.PROJECT_NAME;

// Optional environment variables with defaults
const TIMEFRAME_DAYS = parseInt(process.env.TIMEFRAME_DAYS || '7', 10);
const MAX_PIPELINES = parseInt(process.env.MAX_PIPELINES || '100', 10);

async function main() {
  try {
    if (!API_TOKEN || !ORG_SLUG || !PROJECT_NAME) {
      throw new Error('Required environment variables are not set. Please check your .env file.');
    }

    // Initialize services
    const pipelinesService = new PipelinesService(API_TOKEN, ORG_SLUG, PROJECT_NAME);
    const workflowsService = new WorkflowsService(API_TOKEN);
    const jobsService = new JobsService(API_TOKEN, ORG_SLUG, PROJECT_NAME);

    // Use environment variables for timeframe and max items
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - TIMEFRAME_DAYS);

    const options = {
      startDate,
      endDate,
      maxItems: MAX_PIPELINES
    };

    console.log(`Fetching pipelines for the last ${TIMEFRAME_DAYS} days (max ${MAX_PIPELINES} pipelines)`);

    // Fetch and save pipelines
    const pipelines = await pipelinesService.fetchAllPipelines(options);
    console.log(`Found ${pipelines.length} pipelines between ${startDate.toISOString()} and ${endDate.toISOString()}`);
    await pipelinesService.savePipelinesToFile(pipelines, 'pipelines.json');
    
    // Create pipeline summaries but don't display them
    const pipelineSummaries = pipelinesService.createPipelineSummaries(pipelines);

    // Fetch and save workflows
    console.log('\nFetching workflows...');
    await workflowsService.fetchAllWorkflows(pipelines);

    // Read workflows from file and fetch jobs
    console.log('\nFetching jobs...');
    const workflowsPath = path.join(process.cwd(), 'outputs', 'workflows.json');
    const workflowsData = await fs.readFile(workflowsPath, 'utf-8');
    const workflows: Workflow[] = JSON.parse(workflowsData);
    await jobsService.fetchAllJobs(workflows);

  } catch (error) {
    console.error('Failed to fetch data:', error);
  }
}

// Only run if this file is being run directly
if (require.main === module) {
  main();
}
