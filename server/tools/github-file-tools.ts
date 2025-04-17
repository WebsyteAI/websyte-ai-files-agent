/**
 * GitHub file tools for the AI chat agent
 * Handles file operations with GitHub repositories
 */
import { tool } from "ai";
import { z } from "zod";
import { agentContext } from "../agent";
import { GitHubModule } from "../agents/GitHubModule";
import type { FileRecord, GitHubContent, GitHubDirectoryItem, GitHubFileContent } from "../types";

/**
 * Tool to publish files to GitHub
 */
export const publishToGitHub = tool({
  description: "Publish files from the agent's state to a GitHub repository",
  parameters: z.object({
    commitMessage: z.string().describe("Commit message for the changes"),
  }),
  execute: async ({ commitMessage }) => {
    const agent = agentContext.getStore();
    if (!agent) throw new Error("Agent context not found");
    const github = new GitHubModule(agent.state);
    return await github.publishFiles(commitMessage);
  },
});

/**
 * Tool to sync files from GitHub to the agent's state
 */
export const syncFromGitHub = tool({
  description:
    "Sync files from a GitHub repository to the agent's state (repo is source of truth)",
  parameters: z.object({
    path: z
      .string()
      .optional()
      .describe(
        "Optional path within the repository to sync (default: entire repo)"
      ),
  }),
  execute: async ({ path = "" }) => {
    const agent = agentContext.getStore();
    if (!agent) throw new Error("Agent context not found");
    const github = new GitHubModule(agent.state);
    return await github.syncFiles(path);
  },
});

/**
 * Tool to revert the agent's state to a specific commit from the configured repository
 */
export const revertToCommit = tool({
  description:
    "Sync files from a specific commit in the configured GitHub repository to the agent's state.",
  parameters: z.object({
    commitSha: z.string().describe("The SHA of the commit to revert to"),
  }),
  execute: async ({ commitSha }) => {
    const agent = agentContext.getStore();
    if (!agent) throw new Error("Agent context not found");
    const github = new GitHubModule(agent.state);
    return await github.revertToCommit(commitSha);
  },
});

/**
 * Tool to delete a file from GitHub
 */
export const deleteFileFromGitHub = tool({
  description: "Delete a file from the configured GitHub repository",
  parameters: z.object({
    path: z.string().describe("Path to the file to delete"),
    commitMessage: z.string().describe("Commit message for the deletion"),
  }),
  execute: async ({ path, commitMessage }) => {
    const agent = agentContext.getStore();
    if (!agent) throw new Error("Agent context not found");
    const github = new GitHubModule(agent.state);
    return await github.deleteFile(path, commitMessage);
  },
});

// Export all GitHub file tools
export const githubFileTools = {
  publishToGitHub,
  syncFromGitHub,
  revertToCommit,
  deleteFileFromGitHub,
};
