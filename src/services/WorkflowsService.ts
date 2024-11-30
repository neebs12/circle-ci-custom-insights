import axios, { AxiosResponse } from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { Pipeline, Workflow, WorkflowResponse } from '../types';

export class WorkflowsService {
  private readonly apiToken: string;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
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
      console.log(`Fetching workflows for ${pipelines.length} pipelines...`);

      const allWorkflows: Workflow[] = [];
      let completedPipelines = 0;

      // Process pipelines in batches to avoid overwhelming the API
      const batchSize = 5;
      for (let i = 0; i < pipelines.length; i += batchSize) {
        const batch = pipelines.slice(i, i + batchSize);
        const workflowPromises = batch.map(pipeline => 
          this.fetchWorkflowsForPipeline(pipeline.id, pipeline.vcs?.branch || '')
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
}