/**
 * Common types used across the application
 * Centralizes type definitions to avoid circular dependencies
 */

/**
 * File system record structure
 * Represents a file in the agent's state
 */
export interface FileRecord {
  content: string;
  created: string;
  modified: string;
  streaming?: boolean;
}

/**
 * GitHub build status structure
 * Represents the build status of a GitHub repository
 */
export interface GitHubBuildStatus {
  state: string;
  statuses: Array<{
    state: string;
    description: string;
    context: string;
    target_url: string;
    created_at: string;
    updated_at: string;
  }>;
  check_runs?: Array<{
    name: string;
    status: string;
    conclusion: string | null;
    started_at: string;
    completed_at: string | null;
    html_url: string;
    app: {
      name: string;
    };
  }>;
}

/**
 * GitHub commit structure
 * Represents a commit in a GitHub repository
 */
export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    }
  };
  html_url: string;
  author: {
    login: string;
    avatar_url: string;
  } | null;
}

/**
 * Agent state structure
 * Defines the shape of the agent's persistent state
 */
export interface AgentState {
  files: Record<string, FileRecord>;
  agentName?: string;
  buildStatus?: {
    repository: string;
    ref: string;
    status: GitHubBuildStatus;
    timestamp: string;
  };
  commitHistory?: {
    repository: string;
    branch: string;
    commits: GitHubCommit[];
    timestamp: string;
  };
  // GitHub configuration
  github?: {
    owner: string;
    repo?: string;
    branch: string;
  };
  // Cloudflare Worker configuration
  dispatchNamespace?: string;
  dispatchNamespaceAccountId?: string;
}

/**
 * GitHub API response types
 */
export interface GitHubFileContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: "file";
  content: string;
  encoding: string;
}

export interface GitHubDirectoryItem {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  type: "file" | "dir";
}

export type GitHubContent = GitHubFileContent | GitHubDirectoryItem[];

/**
 * Tool execution response
 */
export interface ToolExecutionResponse {
  success: boolean;
  content?: any; // Changed from string to any to support complex return types
  message?: string;
}
