export interface CircleCIResponse {
  next_page_token: string | null;
  items: Pipeline[];
}

export interface Pipeline {
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

export interface Workflow {
  pipeline_id: string;
  id: string;
  name: string;
  project_slug: string;
  status: string;
  started_by: string;
  pipeline_number: number;
  created_at: string;
  stopped_at: string;
  branch?: string;
}

export interface WorkflowResponse {
  next_page_token: string | null;
  items: Workflow[];
}

export interface PipelineSummary {
  id: string;
  branch: string;
  created_at: string;
}

export interface FetchOptions {
  startDate: Date;
  endDate: Date;
  maxItems?: number;
}

export interface Job {
  job_number: number;
  stopped_at: string;
  started_at: string;
  name: string;
  project_slug: string;
  type: string;
  status: string;
  id: string;
  dependencies: string[];
}

export interface JobsResponse {
  next_page_token: string | null;
  items: Job[];
}

// V1.1 API Types
export interface JobOutputEntry {
  message: string;
  time: string;
  type: string;
  truncated: boolean;
}

export interface JobOutputError {
  message: string;
}

export interface JobAction {
  index: number;
  start_time: string;
  name: string;
  has_output: boolean;
  output_url: string;
  status: string;
  timedout: boolean | null;
  _output?: JobOutputEntry[] | JobOutputError;
}

export interface JobStep {
  name: string;
  actions: JobAction[];
}

export interface JobDetail {
  author_date: string;
  branch: string;
  build_num: number;
  build_url: string;
  committer_date: string;
  failed: boolean;
  lifecycle: string;
  outcome: string;
  retries: number[];
  retry_of: number | null;
  ssh_disabled: boolean;
  start_time: string;
  status: string;
  steps: JobStep[];
  circle_yml?: any;
}

// Retry tracking types
export interface RetryEntry {
  id: number;
  retry_count: number;
  last_attempt: string;
  job_name?: string; // Optional, but helpful for debugging
}

export interface RetryData {
  entries: RetryEntry[];
}
