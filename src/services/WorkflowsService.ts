import axios, { AxiosResponse } from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { Pipeline, Workflow, WorkflowResponse } from '../types';

export class WorkflowsService {
  private readonly apiToken: string;
  private readonly batchSize: number;
  private readonly outputPath: string;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
    // Get batch size from environment variable or use default
    this.batchSize = parseInt(process.env.BATCH_SIZE || '5', 10);
    this.outputPath = path.join(process.cwd(), 'outputs', 'workflows.json');
  }

  private async fetchWorkflowsForPipeline(pipelineId: string, branch: string): Promise<Workflow[]> {
    try {
      const url = `https://circleci.com/api/v2/pipeline/${pipelineId}/workflow`;
      const response: AxiosResponse<WorkflowResponse> = await axios.get(url, {
        headers: {
          'Circle-Token': this.apiToken
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

  async fetchAllWorkflows(pipelines: Pipeline[]): Promise<void> {
    try {
      console.log(`Fetching workflows for ${pipelines.length} pipelines (batch size: ${this.batchSize})...`);

      // Initialize workflows file with empty array
      await fs.writeFile(this.outputPath, JSON.stringify([], null, 2));

      const allWorkflows: Workflow[] = [];
      let completedPipelines = 0;

      // Process pipelines in batches using configurable batch size
      for (let i = 0; i < pipelines.length; i += this.batchSize) {
        const batch = pipelines.slice(i, i + this.batchSize);
        const workflowPromises = batch.map(pipeline =>
          this.fetchWorkflowsForPipeline(pipeline.id, pipeline.vcs?.branch || '')
        );

        const workflowResults = await Promise.all(workflowPromises);
        workflowResults.forEach(workflows => allWorkflows.push(...workflows));

        // Save current state after each batch
        await fs.writeFile(this.outputPath, JSON.stringify(allWorkflows, null, 2));

        completedPipelines += batch.length;
        console.log(`Progress: ${completedPipelines}/${pipelines.length} pipelines processed (${allWorkflows.length} workflows saved)`);
      }

      console.log(`Total workflows fetched and saved: ${allWorkflows.length}`);

    } catch (error) {
      console.error('Error processing workflows:', error);
      throw error;
    }
  }
}
