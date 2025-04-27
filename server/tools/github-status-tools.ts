/**
 * GitHub status tools for the AI chat agent
 * Handles status and commit history operations for GitHub repositories
 */
import { tool } from "ai";
import { z } from "zod";
import { agentContext } from "../agent";
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
    try {
      const agent = agentContext.getStore();
      if (!agent) throw new Error("Agent context not found");
      
      const github = agent.state.github;
      const owner = github?.owner;
      const repo = agent.state.agentName;
      
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
      
      const authToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
      if (!authToken) {
        return {
          success: false,
          message: "GITHUB_PERSONAL_ACCESS_TOKEN environment variable not set.",
        };
      }
      
      const headers = {
        Accept: "application/vnd.github.v3+json",
        Authorization: `token ${authToken}`,
        "User-Agent": "WebsyteAI-Agent",
      };
      
      const apiBaseUrl = "https://api.github.com";
      const statusUrl = `${apiBaseUrl}/repos/${owner}/${repo}/commits/${ref}/status`;
      
      const statusResponse = await fetch(statusUrl, { method: "GET", headers });
      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        return {
          success: false,
          message: `Failed to get build status: ${statusResponse.status}. Details: ${errorText}`,
        };
      }
      
      const statusData = await statusResponse.json();
      
      const checksUrl = `${apiBaseUrl}/repos/${owner}/${repo}/commits/${ref}/check-runs`;
      const checksHeaders = { 
        ...headers, 
        Accept: "application/vnd.github.v3+json, application/vnd.github.check-runs+json"
      };
      const checksResponse = await fetch(checksUrl, { method: "GET", headers: checksHeaders });
      
      let checksData = null;
      if (checksResponse.ok) {
        checksData = await checksResponse.json();
      }
      
      const buildStatus: GitHubBuildStatus = {
        state: statusData.state,
        statuses: statusData.statuses || [],
      };
      
      if (checksData && checksData.check_runs) {
        buildStatus.check_runs = checksData.check_runs.map((run: any) => ({
          name: run.name,
          status: run.status,
          conclusion: run.conclusion,
          started_at: run.started_at,
          completed_at: run.completed_at,
          html_url: run.html_url,
          app: { name: run.app.name },
        }));
      }
      
      if (updateAgentState) {
        await agent.setState({
          ...agent.state,
          buildStatus: {
            repository: `${owner}/${repo}`,
            ref,
            status: buildStatus,
            timestamp: new Date().toISOString(),
          },
        });
      }
      
      const summary = {
        repository: `${owner}/${repo}`,
        ref,
        state: buildStatus.state,
        statusCount: buildStatus.statuses.length,
        checkRunsCount: buildStatus.check_runs?.length || 0,
        failedStatuses: buildStatus.statuses.filter((s: any) => s.state !== "success").length,
        failedCheckRuns:
          buildStatus.check_runs?.filter((c: any) => c.conclusion !== "success" && c.status === "completed").length || 0,
        pendingCheckRuns:
          buildStatus.check_runs?.filter((c: any) => c.status !== "completed").length || 0,
      };
      
      return {
        success: true,
        message: `Successfully retrieved build status for ${owner}/${repo}@${ref}`,
        summary,
        buildStatus,
      };
    } catch (error) {
      console.error("Error getting build status:", error);
      return {
        success: false,
        message: `Error getting build status: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
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
 * Tool to get GitHub Actions workflow runs for a repository
 */
export const getGitHubWorkflowRuns = tool({
  description:
    "Get GitHub Actions workflow runs for the configured repository.",
  parameters: z.object({
    workflow_id: z
      .string()
      .optional()
      .describe("Workflow ID or file name (e.g., 'ci.yml'). If not provided, gets all workflow runs."),
    branch: z
      .string()
      .optional()
      .describe("Branch to filter workflow runs by (default: uses branch from agent state)"),
    status: z
      .enum(["completed", "action_required", "cancelled", "failure", "neutral", "skipped", "stale", "success", "timed_out", "in_progress", "queued", "requested", "waiting"])
      .optional()
      .describe("Filter workflow runs by status"),
    per_page: z
      .number()
      .optional()
      .default(10)
      .describe("Number of workflow runs to fetch per page (default: 10)"),
    page: z
      .number()
      .optional()
      .default(1)
      .describe("Page number for pagination (default: 1)"),
    updateAgentState: z
      .boolean()
      .optional()
      .default(false)
      .describe("Whether to update the agent state with the workflow runs information"),
  }),
  execute: async ({ 
    workflow_id, 
    branch: inputBranch, 
    status, 
    per_page = 10, 
    page = 1, 
    updateAgentState = false 
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

      // Use input branch if provided, otherwise use branch from state
      const branch = inputBranch || stateBranch;

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

      // Build the URL for workflow runs
      let workflowRunsUrl = `${apiBaseUrl}/repos/${owner}/${repo}/actions/runs`;
      
      // If a specific workflow ID is provided, use that endpoint instead
      if (workflow_id) {
        workflowRunsUrl = `${apiBaseUrl}/repos/${owner}/${repo}/actions/workflows/${workflow_id}/runs`;
      }

      // Add query parameters
      const queryParams = new URLSearchParams();
      if (branch) {
        queryParams.append("branch", branch);
      }
      if (status) {
        queryParams.append("status", status);
      }
      queryParams.append("per_page", per_page.toString());
      queryParams.append("page", page.toString());

      const finalUrl = `${workflowRunsUrl}?${queryParams.toString()}`;
      console.log(`Fetching workflow runs from: ${finalUrl}`);

      const runsResponse = await fetch(finalUrl, {
        method: "GET",
        headers,
      });

      if (!runsResponse.ok) {
        const errorText = await runsResponse.text();
        console.error(
          `GitHub API error (${runsResponse.status}): ${errorText}`
        );
        return {
          success: false,
          message: `Failed to get workflow runs: ${runsResponse.status}. Details: ${errorText}`,
        };
      }

      const runsData = await runsResponse.json();

      // Update agent state if requested
      if (updateAgentState) {
        try {
          const agent = agentContext.getStore();
          if (!agent) {
            console.warn("Agent context not found, cannot update state");
          } else {
            const currentState = agent.state || {};

            // Create a new state object with the workflow runs
            await agent.setState({
              ...currentState,
              workflowRuns: {
                repository: `${owner}/${repo}`,
                workflow_id: workflow_id || "all",
                branch: branch || "all",
                runs: runsData.workflow_runs || [],
                timestamp: new Date().toISOString(),
              },
            });

            console.log("Updated agent state with workflow runs information");
          }
        } catch (stateError) {
          console.error("Error updating agent state:", stateError);
        }
      }

      return {
        success: true,
        message: `Successfully retrieved ${runsData.total_count || 0} workflow runs from ${owner}/${repo}`,
        workflow_runs: runsData.workflow_runs || [],
        total_count: runsData.total_count || 0,
      };
    } catch (error) {
      console.error("Error getting GitHub workflow runs:", error);
      return {
        success: false,
        message: `Error getting GitHub workflow runs: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});

/**
 * Tool to get logs for a specific GitHub Actions workflow run
 */
export const getGitHubWorkflowLogs = tool({
  description:
    "Get logs for a specific GitHub Actions workflow run.",
  parameters: z.object({
    run_id: z
      .string()
      .describe("The ID of the workflow run to get logs for"),
    job_id: z
      .string()
      .optional()
      .describe("The ID of a specific job within the workflow run to get logs for. If not provided, gets logs for all jobs."),
    updateAgentState: z
      .boolean()
      .optional()
      .default(false)
      .describe("Whether to update the agent state with the workflow logs information"),
  }),
  execute: async ({ run_id, job_id, updateAgentState = false }) => {
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

      // If a job_id is provided, get logs for that specific job
      if (job_id) {
        const jobLogsUrl = `${apiBaseUrl}/repos/${owner}/${repo}/actions/jobs/${job_id}/logs`;
        console.log(`Fetching logs for job ${job_id} from: ${jobLogsUrl}`);

        const logsResponse = await fetch(jobLogsUrl, {
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

                // Create a new state object with the workflow logs
                await agent.setState({
                  ...currentState,
                  workflowLogs: {
                    repository: `${owner}/${repo}`,
                    run_id,
                    job_id,
                    logs,
                    timestamp: new Date().toISOString(),
                  },
                });

                console.log("Updated agent state with workflow logs information");
              }
            } catch (stateError) {
              console.error("Error updating agent state:", stateError);
            }
          }

          return {
            success: true,
            message: `Successfully retrieved logs for job ${job_id} in workflow run ${run_id}`,
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

                // Create a new state object with the workflow logs
                await agent.setState({
                  ...currentState,
                  workflowLogs: {
                    repository: `${owner}/${repo}`,
                    run_id,
                    job_id,
                    logs,
                    timestamp: new Date().toISOString(),
                  },
                });

                console.log("Updated agent state with workflow logs information");
              }
            } catch (stateError) {
              console.error("Error updating agent state:", stateError);
            }
          }

          return {
            success: true,
            message: `Successfully retrieved logs for job ${job_id} in workflow run ${run_id}`,
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
      } else {
        // If no job_id is provided, first get the list of jobs for the workflow run
        const jobsUrl = `${apiBaseUrl}/repos/${owner}/${repo}/actions/runs/${run_id}/jobs`;
        console.log(`Fetching jobs for workflow run ${run_id} from: ${jobsUrl}`);

        const jobsResponse = await fetch(jobsUrl, {
          method: "GET",
          headers,
        });

        if (!jobsResponse.ok) {
          const errorText = await jobsResponse.text();
          console.error(
            `GitHub API error (${jobsResponse.status}): ${errorText}`
          );
          return {
            success: false,
            message: `Failed to get jobs for workflow run: ${jobsResponse.status}. Details: ${errorText}`,
          };
        }

        const jobsData = await jobsResponse.json();
        const jobs = jobsData.jobs || [];

        if (jobs.length === 0) {
          return {
            success: false,
            message: `No jobs found for workflow run ${run_id}`,
          };
        }

        // Get logs for each job
        const jobLogs = [];
        for (const job of jobs) {
          try {
            const jobLogsUrl = `${apiBaseUrl}/repos/${owner}/${repo}/actions/jobs/${job.id}/logs`;
            console.log(`Fetching logs for job ${job.id} (${job.name}) from: ${jobLogsUrl}`);

            const logsResponse = await fetch(jobLogsUrl, {
              method: "GET",
              headers: {
                ...headers,
                Accept: "application/vnd.github.v3.raw", // Request raw logs
              },
              redirect: "follow", // Follow redirects
            });

            let logs = "";
            if (logsResponse.status === 302 || logsResponse.status === 307) {
              const redirectUrl = logsResponse.headers.get("location");
              if (redirectUrl) {
                const redirectResponse = await fetch(redirectUrl);
                if (redirectResponse.ok) {
                  logs = await redirectResponse.text();
                }
              }
            } else if (logsResponse.ok) {
              logs = await logsResponse.text();
            }

            jobLogs.push({
              job_id: job.id.toString(),
              job_name: job.name,
              status: job.status,
              conclusion: job.conclusion,
              logs,
            });

            // Add a small delay to avoid rate limiting
            await new Promise((resolve) => setTimeout(resolve, 100));
          } catch (error) {
            console.error(`Error fetching logs for job ${job.id}:`, error);
            jobLogs.push({
              job_id: job.id.toString(),
              job_name: job.name,
              status: job.status,
              conclusion: job.conclusion,
              logs: `Error fetching logs: ${error instanceof Error ? error.message : String(error)}`,
            });
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

              // Create a new state object with the workflow logs
              await agent.setState({
                ...currentState,
                workflowLogs: {
                  repository: `${owner}/${repo}`,
                  run_id,
                  jobs: jobLogs,
                  timestamp: new Date().toISOString(),
                },
              });

              console.log("Updated agent state with workflow logs information");
            }
          } catch (stateError) {
            console.error("Error updating agent state:", stateError);
          }
        }

        return {
          success: true,
          message: `Successfully retrieved logs for ${jobLogs.length} jobs in workflow run ${run_id}`,
          jobs: jobLogs,
        };
      }
    } catch (error) {
      console.error("Error getting GitHub workflow logs:", error);
      return {
        success: false,
        message: `Error getting GitHub workflow logs: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});

// Export all GitHub status tools
export const githubStatusTools = {
  getGitHubBuildStatus,
  getCommitHistory,
  getGitHubWorkflowRuns,
  getGitHubWorkflowLogs,
};
