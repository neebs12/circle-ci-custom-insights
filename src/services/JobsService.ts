import axios, { AxiosResponse } from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { Job, JobWithContext, Workflow } from '../types';

interface JobsResponse {
  next_page_token: string | null;
  items: Job[];
}

export class JobsService {
  private readonly apiToken: string;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  private async fetchJobsForWorkflow(workflow: Workflow): Promise<JobWithContext[]> {
    try {
      const url = `https://circleci.com/api/v2/workflow/${workflow.id}/job`;
      const response: AxiosResponse<JobsResponse> = await axios.get(url, {
        headers: {
          'Circle-Token': this.apiToken
        }
      });

      // Add workflow context to each job
      return response.data.items.map(job => ({
        ...job,
        workflow_id: workflow.id,
        workflow_name: workflow.name,
        pipeline_id: workflow.pipeline_id,
        branch: workflow.branch || ''
      }));
    } catch (error) {
      console.error(`Error fetching jobs for workflow ${workflow.id}:`, error);
      return [];
    }
  }

  async fetchAllJobs(workflows: Workflow[]): Promise<void> {
    try {
      console.log(`Fetching jobs for ${workflows.length} workflows...`);

      const allJobs: JobWithContext[] = [];
      let completedWorkflows = 0;

      // Process workflows in batches to avoid overwhelming the API
      const batchSize = 5;
      for (let i = 0; i < workflows.length; i += batchSize) {
        const batch = workflows.slice(i, i + batchSize);
        const jobPromises = batch.map(workflow => 
          this.fetchJobsForWorkflow(workflow)
        );

        const jobResults = await Promise.all(jobPromises);
        jobResults.forEach(jobs => allJobs.push(...jobs));

        completedWorkflows += batch.length;
        console.log(`Progress: ${completedWorkflows}/${workflows.length} workflows processed`);
      }

      // Save jobs to file
      const jobsPath = path.join(process.cwd(), 'outputs', 'jobs.json');
      await fs.writeFile(jobsPath, JSON.stringify(allJobs, null, 2));
      console.log(`Job data saved to outputs/jobs.json`);
      console.log(`Total jobs fetched: ${allJobs.length}`);

    } catch (error) {
      console.error('Error processing jobs:', error);
      throw error;
    }
  }
}
