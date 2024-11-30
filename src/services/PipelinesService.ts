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
    
    do {
      try {
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
