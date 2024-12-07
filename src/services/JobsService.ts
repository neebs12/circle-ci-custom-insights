import axios, { AxiosResponse } from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { Job, JobsResponse, Workflow, JobDetail, JobOutputEntry, JobOutputError, JobStep, JobAction, RetryEntry } from '../types';

export class JobsService {
  private readonly apiToken: string;
  private readonly orgSlug: string;
  private readonly projectName: string;
  private readonly retryFile = path.join(process.cwd(), 'outputs', 'jobs', '_retry.json');
  private readonly jobsPath: string;
  private readonly jobsDir: string;
  private readonly batchSize: number;

  constructor(apiToken: string, orgSlug: string, projectName: string) {
    this.apiToken = apiToken;
    this.orgSlug = orgSlug;
    this.projectName = projectName;
    this.jobsPath = path.join(process.cwd(), 'outputs', 'jobs.json');
    this.jobsDir = path.join(process.cwd(), 'outputs', 'jobs');
    // Get batch size from environment variable or use default
    this.batchSize = parseInt(process.env.BATCH_SIZE || '5', 10);
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  private async addToRetryFile(jobNumber: number, jobName: string): Promise<void> {
    try {
      let retryData = { entries: [] as RetryEntry[] };

      try {
        const content = await fs.readFile(this.retryFile, 'utf-8');
        retryData = JSON.parse(content);
      } catch (error) {
        // File doesn't exist or is invalid, use empty data
      }

      // Only add if not already present
      if (!retryData.entries.some(entry => entry.id === jobNumber)) {
        retryData.entries.push({
          id: jobNumber,
          retry_count: 0,
          last_attempt: new Date().toISOString(),
          job_name: jobName
        });

        await this.ensureDirectoryExists(path.dirname(this.retryFile));
        await fs.writeFile(this.retryFile, JSON.stringify(retryData, null, 2));
      }
    } catch (error) {
      console.error('Error adding to retry file:', error);
    }
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
      await this.ensureDirectoryExists(logDir);
      const logPath = path.join(logDir, 'failed_job_fetches.log');

      const logEntry = `Job ID: ${job.id}, Job Number: ${job.job_number}, Time: ${new Date().toISOString()}, Reason: ${reason}\n`;

      await fs.appendFile(logPath, logEntry);
    } catch (error) {
      console.error('Error logging failed job:', error);
    }
  }

  private async fetchJobOutput(outputUrl: string): Promise<JobOutputEntry[] | JobOutputError | null> {
    try {
      const response = await axios.get(outputUrl, {
        headers: {
          'Circle-Token': this.apiToken
        }
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return { message: "Build not found" };
      }
      console.error('Error fetching job output:', error);
      return null;
    }
  }

  private getSkipMessage(status: string): string {
    switch (status) {
      case 'success':
        return "Skipped output due to action success";
      case 'canceled':
        return "Skipped output due to action being canceled";
      default:
        return `Skipped output due to action status: ${status}`;
    }
  }

  private async processStepWithOutputs(step: JobStep): Promise<JobStep> {
    const processedActions = await Promise.all(
      step.actions.map(async (action) => {
        if (action.has_output && action.output_url) {
          // Skip output fetching for successful or canceled actions
          if (action.status === 'success' || action.status === 'canceled') {
            return {
              ...action,
              _output: { message: this.getSkipMessage(action.status) }
            };
          }

          // For other statuses (failed, timedout, etc.), fetch the full output
          const output = await this.fetchJobOutput(action.output_url);
          if (output) {
            return {
              ...action,
              _output: output
            };
          }
        }
        return action;
      })
    );

    return {
      ...step,
      actions: processedActions
    };
  }

  public async retryJobDetail(jobNumber: number, jobName: string): Promise<void> {
    try {
      const url = `https://circleci.com/api/v1.1/project/${this.orgSlug}/${this.projectName}/${jobNumber}`;
      const response: AxiosResponse<JobDetail> = await axios.get(url, {
        headers: {
          'Circle-Token': this.apiToken
        }
      });

      // Remove circle_yml from the response data
      const { circle_yml, ...jobDataWithoutCircleYml } = response.data;

      // Process each step to fetch outputs for its actions
      const processedSteps = await Promise.all(
        response.data.steps.map(step => this.processStepWithOutputs(step))
      );

      const finalJobData = {
        ...jobDataWithoutCircleYml,
        steps: processedSteps
      };

      // Ensure the jobs directory exists
      await this.ensureDirectoryExists(this.jobsDir);

      // Save filtered response to file
      const filename = `${jobNumber}-${jobName.replace(/[^a-zA-Z0-9-_]/g, '_')}.json`;
      const filePath = path.join(this.jobsDir, filename);
      await fs.writeFile(filePath, JSON.stringify(finalJobData, null, 2));

    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        throw error; // Re-throw rate limit errors to be handled by retry manager
      }
      console.error(`Error retrying job detail ${jobNumber}:`, error);
      throw error;
    }
  }

  private async fetchJobDetail(jobNumber: number, jobName: string, job: Job): Promise<void> {
    try {
      if (!jobNumber) {
        await this.logFailedJob(job, 'Job number is undefined');
        return;
      }

      await this.retryJobDetail(jobNumber, jobName);

    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        console.log(`Rate limit hit for job ${jobNumber}, adding to retry queue`);
        await this.addToRetryFile(jobNumber, jobName);
      } else {
        await this.logFailedJob(job, error instanceof Error ? error.message : 'Unknown error');
        console.error(`Error fetching detail for job ${jobNumber}:`, error);
      }
    }
  }

  async fetchAllJobs(workflows: Workflow[]): Promise<void> {
    try {
      console.log(`Fetching jobs for ${workflows.length} workflows...`);

      // Initialize jobs.json with empty array
      await this.ensureDirectoryExists(path.dirname(this.jobsPath));
      await fs.writeFile(this.jobsPath, JSON.stringify([], null, 2));

      const allJobs: Job[] = [];
      let completedWorkflows = 0;

      // Process workflows in batches using configurable batch size
      for (let i = 0; i < workflows.length; i += this.batchSize) {
        const batch = workflows.slice(i, i + this.batchSize);
        const jobPromises = batch.map(workflow =>
          this.fetchJobsForWorkflow(workflow)
        );

        const jobResults = await Promise.all(jobPromises);
        const newJobs: Job[] = [];
        jobResults.forEach(jobs => newJobs.push(...jobs));

        // Add new jobs to the total and save current state
        allJobs.push(...newJobs);
        await fs.writeFile(this.jobsPath, JSON.stringify(allJobs, null, 2));

        completedWorkflows += batch.length;
        console.log(`Progress: ${completedWorkflows}/${workflows.length} workflows processed (${allJobs.length} jobs saved)`);
      }

      // Ensure jobs directory exists for detailed information
      await this.ensureDirectoryExists(this.jobsDir);

      // Fetch and save detailed job information
      console.log('\nFetching detailed job information...');
      let completedJobs = 0;

      // Process jobs in batches using configurable batch size
      for (let i = 0; i < allJobs.length; i += this.batchSize) {
        const batch = allJobs.slice(i, i + this.batchSize);
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
