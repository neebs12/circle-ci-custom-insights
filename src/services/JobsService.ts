import axios, { AxiosResponse } from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { Job, JobsResponse, Workflow, JobDetail } from '../types';

export class JobsService {
  private readonly apiToken: string;
  private readonly orgSlug: string;
  private readonly projectName: string;

  constructor(apiToken: string, orgSlug: string, projectName: string) {
    this.apiToken = apiToken;
    this.orgSlug = orgSlug;
    this.projectName = projectName;
  }

  private async fetchJobsForWorkflow(workflow: Workflow): Promise<Job[]> {
    try {
      const url = `https://circleci.com/api/v2/workflow/${workflow.id}/job`;
      const response: AxiosResponse<JobsResponse> = await axios.get(url, {
        headers: {
          'Circle-Token': this.apiToken
        }
      });

      return response.data.items;
    } catch (error) {
      console.error(`Error fetching jobs for workflow ${workflow.id}:`, error);
      return [];
    }
  }

  private async logFailedJob(job: Job, reason: string): Promise<void> {
    try {
      const logDir = path.join(process.cwd(), 'outputs');
      const logPath = path.join(logDir, 'failed_job_fetches.log');
      
      const logEntry = `Job ID: ${job.id}, Job Number: ${job.job_number}, Time: ${new Date().toISOString()}, Reason: ${reason}\n`;
      
      await fs.appendFile(logPath, logEntry);
    } catch (error) {
      console.error('Error logging failed job:', error);
    }
  }

  private async fetchJobDetail(jobNumber: number, jobName: string, job: Job): Promise<void> {
    try {
      if (!jobNumber) {
        await this.logFailedJob(job, 'Job number is undefined');
        return;
      }

      const url = `https://circleci.com/api/v1.1/project/${this.orgSlug}/${this.projectName}/${jobNumber}`;
      const response: AxiosResponse<JobDetail> = await axios.get(url, {
        headers: {
          'Circle-Token': this.apiToken
        }
      });

      // Ensure the jobs directory exists
      const jobsDir = path.join(process.cwd(), 'outputs', 'jobs');
      await fs.mkdir(jobsDir, { recursive: true });

      // Remove circle_yml from the response data
      const { circle_yml, ...jobDataWithoutCircleYml } = response.data;

      // Save filtered response to file
      const filename = `${jobNumber}-${jobName.replace(/[^a-zA-Z0-9-_]/g, '_')}.json`;
      const filePath = path.join(jobsDir, filename);
      await fs.writeFile(filePath, JSON.stringify(jobDataWithoutCircleYml, null, 2));

    } catch (error) {
      await this.logFailedJob(job, error instanceof Error ? error.message : 'Unknown error');
      console.error(`Error fetching detail for job ${jobNumber}:`, error);
    }
  }

  async fetchAllJobs(workflows: Workflow[]): Promise<void> {
    try {
      console.log(`Fetching jobs for ${workflows.length} workflows...`);

      const allJobs: Job[] = [];
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

      // Save jobs list to file
      const jobsPath = path.join(process.cwd(), 'outputs', 'jobs.json');
      await fs.writeFile(jobsPath, JSON.stringify(allJobs, null, 2));
      console.log(`Job data saved to outputs/jobs.json`);
      console.log(`Total jobs fetched: ${allJobs.length}`);

      // Fetch and save detailed job information
      console.log('\nFetching detailed job information...');
      let completedJobs = 0;
      
      // Process jobs in batches
      for (let i = 0; i < allJobs.length; i += batchSize) {
        const batch = allJobs.slice(i, i + batchSize);
        const detailPromises = batch.map(job => 
          this.fetchJobDetail(job.job_number, job.name, job)
        );

        await Promise.all(detailPromises);
        completedJobs += batch.length;
        console.log(`Progress: ${completedJobs}/${allJobs.length} job details processed`);
      }

      console.log('All job details saved to outputs/jobs/');

    } catch (error) {
      console.error('Error processing jobs:', error);
      throw error;
    }
  }
}
