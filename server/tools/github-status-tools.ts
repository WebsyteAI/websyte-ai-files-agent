/**
 * GitHub status tools for the AI chat agent
 * Handles status and commit history operations for GitHub repositories
 */
import { tool } from "ai";
import { z } from "zod";
import { agentContext } from "../agent";
import { GitHubModule } from "../agents/GitHubModule";
import type { GitHubBuildStatus } from "../types";

/**
 * Tool to get GitHub build status for the configured repository
 */
export const getGitHubBuildStatus = tool({
  description:
    "Get build status information for the configured GitHub repository commit or branch.",
  parameters: z.object({
    ref: z.string().describe("Git reference (commit SHA, branch name, or tag)"),
    updateAgentState: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Whether to update the agent state with the build status information"
      ),
  }),
  execute: async ({ ref, updateAgentState = false }) => {
    const agent = agentContext.getStore();
    if (!agent) throw new Error("Agent context not found");
    const github = new GitHubModule(agent.state);
    return await github.getBuildStatus(ref, updateAgentState);
  },
});

/**
 * Tool to get commit history from the configured GitHub repository
 */
export const getCommitHistory = tool({
  description:
    "Get commit history for the configured GitHub repository branch.",
  parameters: z.object({
    branch: z
      .string()
      .optional()
      .describe(
        "Branch to get history for (default: uses branch from agent state)"
      ),
    perPage: z
      .number()
      .optional()
      .default(10)
      .describe("Number of commits to fetch per page (default: 10)"),
    page: z
      .number()
      .optional()
      .default(1)
      .describe("Page number for pagination (default: 1)"),
    includeBuildStatus: z
      .boolean()
      .optional()
      .default(true)
      .describe("Whether to include build status for each commit"),
    updateAgentState: z
      .boolean()
      .optional()
      .default(true)
      .describe("Whether to update the agent state with the commit history"),
  }),
  execute: async ({
    branch: inputBranch, // Renamed to avoid conflict
    perPage = 10,
    page = 1,
    includeBuildStatus = true,
    updateAgentState = true,
  }) => {
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
      const stateBranch = github?.branch; // Branch from state

      if (!owner) {
        return {
          success: false,
          message: "GitHub owner not configured in agent state.",
        };
      }
      if (!repo) {
        return {
          success: false,
          message: "Agent name (repository name) not found in agent state.",
        };
      }
      // Use input branch if provided, otherwise use branch from state, default to 'main' if neither exists
      const branch = inputBranch || stateBranch || "main";

      // Get token from environment
      const authToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
      if (!authToken) {
        return {
          success: false,
          message: "GITHUB_PERSONAL_ACCESS_TOKEN environment variable not set.",
        };
      }

      // Setup common headers for GitHub API requests
      const headers = {
        Accept: "application/vnd.github.v3+json",
        Authorization: `token ${authToken}`,
        "User-Agent": "WebsyteAI-Agent", // Required by GitHub API
      };

      console.log(`Getting commit history for ${owner}/${repo}/${branch}`);

      // Base URL for GitHub API
      const apiBaseUrl = "https://api.github.com";

      // Get commits for the branch
      const commitsUrl = `${apiBaseUrl}/repos/${owner}/${repo}/commits?sha=${branch}&per_page=${perPage}&page=${page}`;
      console.log(`Fetching commits from: ${commitsUrl}`);

      const commitsResponse = await fetch(commitsUrl, {
        method: "GET",
        headers,
      });

      if (!commitsResponse.ok) {
        const errorText = await commitsResponse.text();
        console.error(
          `GitHub API error (${commitsResponse.status}): ${errorText}`
        );
        return {
          success: false,
          message: `Failed to get commit history: ${commitsResponse.status}. Details: ${errorText}`,
        };
      }

      const commits = await commitsResponse.json();

      // If includeBuildStatus is true, fetch build status for each commit
      if (includeBuildStatus) {
        console.log(`Fetching build status for ${commits.length} commits`);

        // Add build status to each commit
        for (const commit of commits) {
          try {
            // Get combined status for the commit
            const statusUrl = `${apiBaseUrl}/repos/${owner}/${repo}/commits/${commit.sha}/status`;
            console.log(
              `Fetching status for commit ${commit.sha.substring(0, 7)} from: ${statusUrl}`
            );

            const statusResponse = await fetch(statusUrl, {
              method: "GET",
              headers,
            });

            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              commit.status = {
                state: statusData.state,
                total_count: statusData.total_count,
                statuses: statusData.statuses,
              };
            } else {
              console.warn(
                `Could not fetch status for commit ${commit.sha}: ${statusResponse.status}`
              );
              commit.status = { state: "pending" };
            }

            // Add a small delay to avoid rate limiting
            await new Promise((resolve) => setTimeout(resolve, 100));
          } catch (statusError) {
            console.error(
              `Error fetching status for commit ${commit.sha}:`,
              statusError
            );
            commit.status = { state: "pending" };
          }
        }
      }

      // Update agent state if requested
      if (updateAgentState) {
        try {
          const agent = agentContext.getStore();
          if (!agent) {
            console.warn("Agent context not found, cannot update state");
          } else {
            const currentState = agent.state || {};

            // Create a new state object with the commit history
            await agent.setState({
              ...currentState,
              commitHistory: {
                repository: `${owner}/${repo}`,
                branch,
                commits,
                timestamp: new Date().toISOString(),
              },
            });

            console.log("Updated agent state with commit history information");
          }
        } catch (stateError) {
          console.error("Error updating agent state:", stateError);
        }
      }

      return {
        success: true,
        message: `Successfully retrieved ${commits.length} commits from ${owner}/${repo}/${branch}`,
        commits,
      };
    } catch (error) {
      console.error("Error getting GitHub commit history:", error);
      return {
        success: false,
        message: `Error getting GitHub commit history: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});

/**
 * Tool to get build logs for a failed GitHub check run
 */
export const getGitHubBuildLogs = tool({
  description:
    "Get the build logs for a failed GitHub check run to diagnose build failures.",
  parameters: z.object({
    ref: z.string().describe("Git reference (commit SHA, branch name, or tag)"),
    checkRunId: z
      .string()
      .optional()
      .describe(
        "Specific check run ID to get logs for. If not provided, will get logs for the first failed check run."
      ),
    updateAgentState: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Whether to update the agent state with the build logs information"
      ),
  }),
  execute: async ({ ref, checkRunId, updateAgentState = false }) => {
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
        return {
          success: false,
          message: "GitHub owner not configured in agent state.",
        };
      }
      if (!repo) {
        return {
          success: false,
          message: "Agent name (repository name) not found in agent state.",
        };
      }

      // Get token from environment
      const authToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
      if (!authToken) {
        return {
          success: false,
          message: "GITHUB_PERSONAL_ACCESS_TOKEN environment variable not set.",
        };
      }

      // Setup common headers for GitHub API requests
      const headers = {
        Accept: "application/vnd.github.v3+json",
        Authorization: `token ${authToken}`,
        "User-Agent": "WebsyteAI-Agent", // Required by GitHub API
      };

      // Base URL for GitHub API
      const apiBaseUrl = "https://api.github.com";

      let targetCheckRunId = checkRunId;

      // If no specific check run ID is provided, find the first failed check run
      if (!targetCheckRunId) {
        console.log(`Finding failed check runs for ${owner}/${repo}@${ref}`);

        // Get check runs for the reference
        const checksUrl = `${apiBaseUrl}/repos/${owner}/${repo}/commits/${ref}/check-runs`;
        console.log(`Fetching check runs from: ${checksUrl}`);

        const checksHeaders = {
          ...headers,
          Accept: "application/vnd.github.v3+json",
        };

        const checksResponse = await fetch(checksUrl, {
          method: "GET",
          headers: checksHeaders,
        });

        if (!checksResponse.ok) {
          const errorText = await checksResponse.text();
          console.error(
            `GitHub API error (${checksResponse.status}): ${errorText}`
          );
          return {
            success: false,
            message: `Failed to get check runs: ${checksResponse.status}. Details: ${errorText}`,
          };
        }

        const checksData = await checksResponse.json();

        // Find the first failed check run
        const failedCheckRun = checksData.check_runs?.find(
          (run: any) =>
            run.conclusion === "failure" && run.status === "completed"
        );

        if (!failedCheckRun) {
          return {
            success: false,
            message: `No failed check runs found for ${owner}/${repo}@${ref}`,
          };
        }

        targetCheckRunId = failedCheckRun.id;
        console.log(`Found failed check run: ${failedCheckRun.name} (${targetCheckRunId})`);
      }

      // Get logs for the check run
      console.log(`Getting logs for check run ${targetCheckRunId}`);

      // GitHub API endpoint for check run logs
      const logsUrl = `${apiBaseUrl}/repos/${owner}/${repo}/check-runs/${targetCheckRunId}/logs`;
      console.log(`Fetching logs from: ${logsUrl}`);

      const logsResponse = await fetch(logsUrl, {
        method: "GET",
        headers: {
          ...headers,
          Accept: "application/vnd.github.v3.raw", // Request raw logs
        },
        redirect: "follow", // Follow redirects
      });

      // GitHub might return a redirect to download the logs
      if (logsResponse.status === 302 || logsResponse.status === 307) {
        const redirectUrl = logsResponse.headers.get("location");
        if (!redirectUrl) {
          return {
            success: false,
            message: "Received redirect response but no location header",
          };
        }

        console.log(`Redirected to: ${redirectUrl}`);

        // Fetch the logs from the redirect URL
        const redirectResponse = await fetch(redirectUrl);
        if (!redirectResponse.ok) {
          return {
            success: false,
            message: `Failed to fetch logs from redirect URL: ${redirectResponse.status}`,
          };
        }

        const logs = await redirectResponse.text();

        // Update agent state if requested
        if (updateAgentState) {
          try {
            const agent = agentContext.getStore();
            if (!agent) {
              console.warn("Agent context not found, cannot update state");
            } else {
              const currentState = agent.state || {};

              // Create a new state object with the build logs
              await agent.setState({
                ...currentState,
                buildLogs: {
                  repository: `${owner}/${repo}`,
                  ref,
                  checkRunId: String(targetCheckRunId),
                  logs,
                  timestamp: new Date().toISOString(),
                },
              });

              console.log("Updated agent state with build logs information");
            }
          } catch (stateError) {
            console.error("Error updating agent state:", stateError);
          }
        }

        return {
          success: true,
          message: `Successfully retrieved logs for check run ${targetCheckRunId}`,
          logs,
        };
      } else if (logsResponse.ok) {
        // Direct response with logs
        const logs = await logsResponse.text();

        // Update agent state if requested
        if (updateAgentState) {
          try {
            const agent = agentContext.getStore();
            if (!agent) {
              console.warn("Agent context not found, cannot update state");
            } else {
              const currentState = agent.state || {};

              // Create a new state object with the build logs
              await agent.setState({
                ...currentState,
                buildLogs: {
                  repository: `${owner}/${repo}`,
                  ref,
                  checkRunId: String(targetCheckRunId),
                  logs,
                  timestamp: new Date().toISOString(),
                },
              });

              console.log("Updated agent state with build logs information");
            }
          } catch (stateError) {
            console.error("Error updating agent state:", stateError);
          }
        }

        return {
          success: true,
          message: `Successfully retrieved logs for check run ${targetCheckRunId}`,
          logs,
        };
      } else {
        // Error response
        const errorText = await logsResponse.text();
        console.error(
          `GitHub API error (${logsResponse.status}): ${errorText}`
        );
        return {
          success: false,
          message: `Failed to get logs: ${logsResponse.status}. Details: ${errorText}`,
        };
      }
    } catch (error) {
      console.error("Error getting GitHub build logs:", error);
      return {
        success: false,
        message: `Error getting GitHub build logs: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});

// Export all GitHub status tools
export const githubStatusTools = {
  getGitHubBuildStatus,
  getCommitHistory,
  getGitHubBuildLogs,
};
