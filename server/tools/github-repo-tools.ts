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
      if (!agent) {
        throw new Error("Agent context not found");
      }

      // Get GitHub configuration and agent name from agent state
      const currentState = agent.state || {};
      const github = currentState.github;
      const owner = github?.owner; // This is the org or user
      const name = currentState.agentName; // Use agentName as repo name

      if (!owner) {
        return "GitHub owner (user or organization) not configured in agent state.";
      }
      if (!name) {
        return "Agent name (used as repository name) not found in agent state.";
      }

      // Get token from environment
      const authToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
      if (!authToken) {
        return "GITHUB_PERSONAL_ACCESS_TOKEN environment variable not set.";
      }

      // Setup common headers for GitHub API requests
      const headers = {
        Accept: "application/vnd.github.v3+json",
        Authorization: `token ${authToken}`,
        "Content-Type": "application/json",
        "User-Agent": "WebsyteAI-Agent", // Required by GitHub API
      };

      console.log(
        "Using GitHub API with token",
        authToken ? "****" + authToken.slice(-4) : "none"
      );

      // Base URL for GitHub API
      const apiBaseUrl = "https://api.github.com";

      // Always create within the specified organization (owner)
      const endpoint = `${apiBaseUrl}/orgs/${owner}/repos`;

      console.log(`Creating repository ${name} in organization ${owner}`);

      // Create repository
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
        console.error(`GitHub API error (${response.status}): ${errorText}`);
        throw new Error(
          `Failed to create repository: ${response.status} ${response.statusText}. Details: ${errorText}`
        );
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
      console.error("Error creating GitHub repository:", error);
      return {
        success: false,
        message: `Error creating GitHub repository: ${error instanceof Error ? error.message : String(error)}`,
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
      if (!agent) {
        throw new Error("Agent context not found");
      }

      // Get GitHub configuration and agent name from agent state
      const currentState = agent.state || {};
      const github = currentState.github;
      const owner = github?.owner;
      const repo = currentState.agentName;

      if (!owner) {
        return "GitHub owner not configured in agent state.";
      }
      if (!repo) {
        return "Agent name (repository name) not found in agent state.";
      }

      // Get token from environment
      const authToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
      if (!authToken) {
        return "GITHUB_PERSONAL_ACCESS_TOKEN environment variable not set.";
      }

      // Setup common headers for GitHub API requests
      const headers = {
        Accept: "application/vnd.github.v3+json",
        Authorization: `token ${authToken}`,
        "User-Agent": "WebsyteAI-Agent", // Required by GitHub API
      };

      console.log(
        "Using GitHub API with token",
        authToken ? "****" + authToken.slice(-4) : "none"
      );

      // Base URL for GitHub API
      const apiBaseUrl = "https://api.github.com";

      // Check if repository exists
      console.log(`Checking if repository ${owner}/${repo} exists`);

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
        console.error(`GitHub API error (${response.status}): ${errorText}`);
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
            type: repoData.owner.type, // "User" or "Organization"
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
      console.error("Error checking GitHub repository:", error);
      return {
        exists: false,
        error: true,
        message: `Error checking GitHub repository: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});

// Export all GitHub repository tools
export const githubRepoTools = {
  createGitHubRepository,
  checkGitHubRepository,
};
