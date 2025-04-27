/**
 * GitHub repository tools for the AI chat agent
 * Handles GitHub repository creation and management
 */
import { tool } from "ai";
import { z } from "zod";
import { agentContext } from "../agent";

/**
 * Tool to create a new GitHub repository using the agent's name and owner configuration.
 */
export const createGitHubRepository = tool({
  description:
    "Create a new GitHub repository using the agent's configured name and owner.",
  parameters: z.object({
    description: z
      .string()
      .optional()
      .describe("Description of the repository"),
    private: z
      .boolean()
      .optional()
      .default(false)
      .describe("Whether the repository should be private (default: false)"),
    autoInit: z
      .boolean()
      .optional()
      .default(true)
      .describe("Initialize the repository with a README (default: true)"),
  }),
  execute: async ({
    description = "",
    private: isPrivate = false,
    autoInit = true,
  }) => {
    try {
      const agent = agentContext.getStore();
      if (!agent) throw new Error("Agent context not found");
      
      const github = agent.state.github;
      const owner = github?.owner;
      const name = agent.state.agentName;
      
      if (!owner) {
        return { success: false, message: "GitHub owner not configured in agent state." };
      }
      
      if (!name) {
        return { success: false, message: "Agent name (used as repository name) not found in agent state." };
      }
      
      const authToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
      if (!authToken) {
        return { success: false, message: "GITHUB_PERSONAL_ACCESS_TOKEN environment variable not set." };
      }
      
      const headers = {
        Accept: "application/vnd.github.v3+json",
        Authorization: `token ${authToken}`,
        "Content-Type": "application/json",
        "User-Agent": "WebsyteAI-Agent",
      };
      
      const apiBaseUrl = "https://api.github.com";
      const endpoint = `${apiBaseUrl}/orgs/${owner}/repos`;
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name,
          description,
          private: isPrivate,
          auto_init: autoInit,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          message: `Failed to create repository: ${response.status} ${response.statusText}. Details: ${errorText}`,
        };
      }
      
      const repoData = await response.json();
      
      return {
        success: true,
        message: `Successfully created repository ${repoData.full_name}`,
        repository: {
          name: repoData.name,
          fullName: repoData.full_name,
          url: repoData.html_url,
          apiUrl: repoData.url,
          private: repoData.private,
          defaultBranch: repoData.default_branch,
        },
      };
    } catch (error) {
      console.error("Error creating repository:", error);
      return {
        success: false,
        message: `Error creating repository: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});

/**
 * Tool to check if the configured GitHub repository exists
 */
export const checkGitHubRepository = tool({
  description:
    "Check if the GitHub repository configured in the agent state exists and get its information.",
  parameters: z.object({}), // No parameters needed, uses agent state
  execute: async () => {
    try {
      const agent = agentContext.getStore();
      if (!agent) throw new Error("Agent context not found");
      
      const github = agent.state.github;
      const owner = github?.owner;
      const repo = agent.state.agentName;
      
      if (!owner) {
        return { exists: false, message: "GitHub owner not configured in agent state." };
      }
      
      if (!repo) {
        return { exists: false, message: "Agent name (repository name) not found in agent state." };
      }
      
      const authToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
      if (!authToken) {
        return { exists: false, message: "GITHUB_PERSONAL_ACCESS_TOKEN environment variable not set." };
      }
      
      const headers = {
        Accept: "application/vnd.github.v3+json",
        Authorization: `token ${authToken}`,
        "User-Agent": "WebsyteAI-Agent",
      };
      
      const apiBaseUrl = "https://api.github.com";
      const response = await fetch(`${apiBaseUrl}/repos/${owner}/${repo}`, {
        method: "GET",
        headers,
      });
      
      if (response.status === 404) {
        return {
          exists: false,
          message: `Repository ${owner}/${repo} does not exist or you don't have access to it.`,
        };
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        return {
          exists: false,
          error: true,
          message: `Error checking repository: ${response.status} ${response.statusText}. Details: ${errorText}`,
        };
      }
      
      const repoData = await response.json();
      
      return {
        exists: true,
        message: `Repository ${repoData.full_name} exists`,
        repository: {
          name: repoData.name,
          fullName: repoData.full_name,
          description: repoData.description,
          url: repoData.html_url,
          apiUrl: repoData.url,
          private: repoData.private,
          defaultBranch: repoData.default_branch,
          owner: {
            login: repoData.owner.login,
            type: repoData.owner.type,
          },
          createdAt: repoData.created_at,
          updatedAt: repoData.updated_at,
          pushedAt: repoData.pushed_at,
          size: repoData.size,
          stargazersCount: repoData.stargazers_count,
          watchersCount: repoData.watchers_count,
          forksCount: repoData.forks_count,
          openIssuesCount: repoData.open_issues_count,
        },
      };
    } catch (error) {
      console.error("Error checking repository:", error);
      return {
        exists: false,
        error: true,
        message: `Error checking repository: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});

// Export all GitHub repository tools
export const githubRepoTools = {
  createGitHubRepository,
  checkGitHubRepository,
};
