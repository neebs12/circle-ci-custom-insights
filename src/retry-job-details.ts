import fs from 'fs/promises';
import path from 'path';
import { RetryData, RetryEntry } from './types';
import { JobsService } from './services/JobsService';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const RETRY_FILE = path.join(process.cwd(), 'outputs', 'jobs', '_retry.json');

class RetryManager {
  private jobsService: JobsService;

  constructor() {
    const apiToken = process.env.CIRCLE_CI_TOKEN;
    const orgSlug = process.env.CIRCLE_CI_ORG_SLUG;
    const projectName = process.env.CIRCLE_CI_PROJECT_NAME;

    if (!apiToken || !orgSlug || !projectName) {
      throw new Error('Required environment variables are not set');
    }

    this.jobsService = new JobsService(apiToken, orgSlug, projectName);
  }

  private async readRetryFile(): Promise<RetryData> {
    try {
      const content = await fs.readFile(RETRY_FILE, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      // If file doesn't exist or is invalid, return empty data
      return { entries: [] };
    }
  }

  private async writeRetryFile(data: RetryData): Promise<void> {
    const dir = path.dirname(RETRY_FILE);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(RETRY_FILE, JSON.stringify(data, null, 2));
  }

  private async updateEntry(entry: RetryEntry): Promise<void> {
    const data = await this.readRetryFile();
    const existingIndex = data.entries.findIndex(e => e.id === entry.id);

    if (existingIndex >= 0) {
      data.entries[existingIndex] = {
        ...entry,
        retry_count: entry.retry_count + 1,
        last_attempt: new Date().toISOString()
      };
    } else {
      data.entries.push({
        ...entry,
        retry_count: 1,
        last_attempt: new Date().toISOString()
      });
    }

    await this.writeRetryFile(data);
  }

  private async removeEntry(id: number): Promise<void> {
    const data = await this.readRetryFile();
    data.entries = data.entries.filter(entry => entry.id !== id);
    await this.writeRetryFile(data);
  }

  public async retryAll(): Promise<void> {
    const data = await this.readRetryFile();
    
    if (data.entries.length === 0) {
      console.log('No jobs to retry');
      return;
    }

    console.log(`Found ${data.entries.length} jobs to retry`);

    for (const entry of data.entries) {
      console.log(`Retrying job ${entry.id} (attempt ${entry.retry_count + 1})`);
      
      try {
        await this.jobsService.retryJobDetail(entry.id, entry.job_name || 'unknown');
        console.log(`Successfully fetched job ${entry.id}`);
        await this.removeEntry(entry.id);
      } catch (error: any) {
        if (error?.response?.status === 429) {
          console.log(`Rate limit hit for job ${entry.id}, will try again later`);
          await this.updateEntry(entry);
        } else {
          console.error(`Error retrying job ${entry.id}:`, error);
          // For other errors, we still update the retry count and timestamp
          await this.updateEntry(entry);
        }
      }

      // Add a delay between retries to help avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Execute retry script
const retryManager = new RetryManager();
retryManager.retryAll().catch(console.error);
