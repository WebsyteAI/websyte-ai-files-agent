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
 * Agent state structure
 * Defines the shape of the agent's persistent state
 */
export interface AgentState {
  files: Record<string, FileRecord>;
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
  content?: string;
  message?: string;
}
