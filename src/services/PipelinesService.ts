import axios, { AxiosResponse } from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { CircleCIResponse, Pipeline, PipelineSummary, FetchOptions } from '../types';

export class PipelinesService {
  private readonly apiToken: string;
  private readonly orgSlug: string;
  private readonly projectName: string;

  constructor(apiToken: string, orgSlug: string, projectName: string) {
    this.apiToken = apiToken;
    this.orgSlug = orgSlug;
    this.projectName = projectName;
  }

  async fetchAllPipelines(options: FetchOptions): Promise<Pipeline[]> {
    if (!this.apiToken || !this.orgSlug || !this.projectName) {
      throw new Error('Required environment variables are not set. Please check your .env file.');
    }

    const allPipelines: Pipeline[] = [];
    let nextPageToken: string | null = null;
    let pageCount = 0;

    do {
      try {
        pageCount++;
        const url: string = `https://circleci.com/api/v2/project/${this.orgSlug}/${this.projectName}/pipeline${nextPageToken ? `?page-token=${nextPageToken}` : ''}`;
        const response: AxiosResponse<CircleCIResponse> = await axios.get(url, {
          headers: {
            'Circle-Token': this.apiToken
          }
        });

        const { items, next_page_token }: CircleCIResponse = response.data;

        // Filter items by date range
        const filteredItems = items.filter(pipeline => {
          const pipelineDate = new Date(pipeline.created_at);
          return pipelineDate >= options.startDate && pipelineDate <= options.endDate;
        });

        allPipelines.push(...filteredItems);

        // Calculate days ago for the most recent pipeline in this batch
        let daysAgoInfo = '';
        if (filteredItems.length > 0) {
          const mostRecentDate = new Date(filteredItems[0].created_at);
          const now = new Date();
          const diffTime = Math.abs(now.getTime() - mostRecentDate.getTime());
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          daysAgoInfo = diffDays > 0 ?
            ` (${diffDays}d ${diffHours}h ago)` :
            ` (${diffHours}h ago)`;
        }

        console.log(`Progress: Page ${pageCount} - Found ${filteredItems.length} pipelines (Total: ${allPipelines.length}${options.maxItems ? `/${options.maxItems}` : ''})${daysAgoInfo}`);

        // If next_page_token is null, log and break
        if (!next_page_token) {
          console.log('No more pages available (next_page_token is null)');
          break;
        }

        nextPageToken = next_page_token;

        // Check if we've reached the maximum desired items
        if (options.maxItems && allPipelines.length >= options.maxItems) {
          console.log(`Reached maximum number of pipelines (${options.maxItems})`);
          allPipelines.splice(options.maxItems);
          break;
        }

        // If the last item is before our start date, stop paginating
        if (new Date(items[items.length - 1].created_at) < options.startDate) {
          console.log('Reached pipelines before start date, stopping pagination');
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

  async savePipelinesToFile(pipelines: Pipeline[], filename: string): Promise<void> {
    const outputPath = path.join(process.cwd(), 'outputs', filename);
    await fs.writeFile(outputPath, JSON.stringify(pipelines, null, 2));
    console.log(`Pipeline data saved to outputs/${filename}`);
  }

  createPipelineSummaries(pipelines: Pipeline[]): PipelineSummary[] {
    return pipelines.map(pipeline => ({
      id: pipeline.id,
      branch: pipeline.vcs?.branch || '',
      created_at: pipeline.created_at
    }));
  }
}
