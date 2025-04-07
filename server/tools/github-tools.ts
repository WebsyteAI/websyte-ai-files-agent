/**
 * GitHub tools for the AI chat agent
 * Handles GitHub repository operations
 */
import { tool } from "ai";
import { z } from "zod";
import { agentContext } from "../agent";
import type {
  GitHubFileContent,
  GitHubDirectoryItem,
  GitHubContent,
  FileRecord,
  GitHubBuildStatus,
} from "../types";

/**
 * Tool to publish files to GitHub
 */
export const publishToGitHub = tool({
  description: "Publish files from the agent's state to a GitHub repository",
  parameters: z.object({
    commitMessage: z.string().describe("Commit message for the changes"),
  }),
  execute: async ({ commitMessage }) => {
    try {
      const agent = agentContext.getStore();
      if (!agent) {
        throw new Error("Agent context not found");
      }

      // Get files from agent state
      const currentState = agent.state || {};
      const files = currentState.files || {};

      // Get GitHub configuration from agent state
      const github = currentState.github;
      if (!github || !github.owner || !github.branch) {
        return "GitHub configuration (owner, branch) not found in agent state.";
      }
      const owner = github.owner;
      const repo = currentState.agentName; // Use agentName as repo name
      const branch = github.branch;

      if (!repo) {
        return "Agent name (used as repository name) not found in agent state.";
      }

      console.log("Publishing files to GitHub:", files);

      console.log("git state", agent.state);

      if (Object.keys(files).length === 0) {
        return "No files to publish. Create some files first.";
      }

      // Get token from environment
      const authToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
      if (!authToken) {
        return "GitHub token not provided and GITHUB_PERSONAL_ACCESS_TOKEN environment variable not set.";
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

      // Check if repository exists and get its state
      let baseCommitSha;
      let baseTreeSha;
      let branchExists = true;
      let defaultBranch;

      try {
        // Get repository info
        console.log(`Fetching repository info for ${owner}/${repo}`);
        const repoResponse = await fetch(
          `${apiBaseUrl}/repos/${owner}/${repo}`,
          {
            method: "GET",
            headers,
          }
        );

        if (!repoResponse.ok) {
          const errorText = await repoResponse.text();
          console.error(
            `GitHub API error (${repoResponse.status}): ${errorText}`
          );
          throw new Error(
            `Failed to get repository: ${repoResponse.status} ${repoResponse.statusText}. Details: ${errorText}`
          );
        }

        const repoData = await repoResponse.json();
        defaultBranch = repoData.default_branch;

        console.log(`Repository ${owner}/${repo} exists`);

        try {
          // Try to get the branch reference
          console.log(`Checking if branch '${branch}' exists`);
          const refResponse = await fetch(
            `${apiBaseUrl}/repos/${owner}/${repo}/git/refs/heads/${branch}`,
            {
              method: "GET",
              headers,
            }
          );

          if (!refResponse.ok) {
            const errorText = await refResponse.text();
            console.error(
              `GitHub API error (${refResponse.status}): ${errorText}`
            );
            throw new Error(
              `Branch not found: ${refResponse.status}. Details: ${errorText}`
            );
          }

          const refData = await refResponse.json();

          // Branch exists
          baseCommitSha = refData.object.sha;

          // Get the base tree
          console.log(`Getting commit details for SHA: ${baseCommitSha}`);
          const commitResponse = await fetch(
            `${apiBaseUrl}/repos/${owner}/${repo}/git/commits/${baseCommitSha}`,
            {
              method: "GET",
              headers,
            }
          );

          if (!commitResponse.ok) {
            const errorText = await commitResponse.text();
            console.error(
              `GitHub API error (${commitResponse.status}): ${errorText}`
            );
            throw new Error(
              `Failed to get commit: ${commitResponse.status}. Details: ${errorText}`
            );
          }

          const baseCommit = await commitResponse.json();
          baseTreeSha = baseCommit.tree.sha;
        } catch (branchError) {
          // Branch doesn't exist, use the default branch as base
          console.log(
            `Branch '${branch}' not found, will create it using default branch as base`
          );
          branchExists = false;

          console.log(`Using default branch '${defaultBranch}' as base`);

          // Get the SHA of the default branch
          console.log(`Getting default branch '${defaultBranch}' reference`);
          const defaultBranchResponse = await fetch(
            `${apiBaseUrl}/repos/${owner}/${repo}/git/refs/heads/${defaultBranch}`,
            {
              method: "GET",
              headers,
            }
          );

          if (!defaultBranchResponse.ok) {
            const errorText = await defaultBranchResponse.text();
            console.error(
              `GitHub API error (${defaultBranchResponse.status}): ${errorText}`
            );
            throw new Error(
              `Failed to get default branch: ${defaultBranchResponse.status}. Details: ${errorText}`
            );
          }

          const defaultBranchData = await defaultBranchResponse.json();
          baseCommitSha = defaultBranchData.object.sha;

          // Get the base tree
          console.log(
            `Getting commit details for default branch SHA: ${baseCommitSha}`
          );
          const baseCommitResponse = await fetch(
            `${apiBaseUrl}/repos/${owner}/${repo}/git/commits/${baseCommitSha}`,
            {
              method: "GET",
              headers,
            }
          );

          if (!baseCommitResponse.ok) {
            const errorText = await baseCommitResponse.text();
            console.error(
              `GitHub API error (${baseCommitResponse.status}): ${errorText}`
            );
            throw new Error(
              `Failed to get base commit: ${baseCommitResponse.status}. Details: ${errorText}`
            );
          }

          const baseCommit = await baseCommitResponse.json();
          baseTreeSha = baseCommit.tree.sha;
        }
      } catch (error) {
        console.error("Error getting repository information:", error);
        return `Error: Could not get repository information. Make sure the repository exists and you have access to it.`;
      }

      // Create blobs for each file
      console.log(`Creating blobs for ${Object.keys(files).length} files`);
      const fileBlobs = await Promise.all(
        Object.entries(files).map(async ([path, fileData]) => {
          console.log(`Creating blob for file: ${path}`);
          const blobResponse = await fetch(
            `${apiBaseUrl}/repos/${owner}/${repo}/git/blobs`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                content: fileData.content,
                encoding: "utf-8",
              }),
            }
          );

          if (!blobResponse.ok) {
            const errorText = await blobResponse.text();
            console.error(
              `GitHub API error (${blobResponse.status}): ${errorText}`
            );
            throw new Error(
              `Failed to create blob for ${path}: ${blobResponse.status}. Details: ${errorText}`
            );
          }

          const data = await blobResponse.json();
          console.log(
            `Blob created for ${path} with SHA: ${data.sha.slice(0, 7)}...`
          );

          return {
            path,
            mode: "100644", // Regular file
            type: "blob",
            sha: data.sha,
          };
        })
      );

      // Create a new tree with the file blobs
      console.log(
        `Creating tree with ${fileBlobs.length} blobs, base tree: ${baseTreeSha.slice(0, 7)}...`
      );
      const treeResponse = await fetch(
        `${apiBaseUrl}/repos/${owner}/${repo}/git/trees`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            base_tree: baseTreeSha,
            tree: fileBlobs,
          }),
        }
      );

      if (!treeResponse.ok) {
        const errorText = await treeResponse.text();
        console.error(
          `GitHub API error (${treeResponse.status}): ${errorText}`
        );
        throw new Error(
          `Failed to create tree: ${treeResponse.status}. Details: ${errorText}`
        );
      }

      const newTree = await treeResponse.json();

      // Create a new commit
      console.log(
        `Creating commit with message: "${commitMessage}", tree: ${newTree.sha.slice(0, 7)}...`
      );
      const commitResponse = await fetch(
        `${apiBaseUrl}/repos/${owner}/${repo}/git/commits`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            message: commitMessage,
            tree: newTree.sha,
            parents: [baseCommitSha],
          }),
        }
      );

      if (!commitResponse.ok) {
        const errorText = await commitResponse.text();
        console.error(
          `GitHub API error (${commitResponse.status}): ${errorText}`
        );
        throw new Error(
          `Failed to create commit: ${commitResponse.status}. Details: ${errorText}`
        );
      }

      const newCommit = await commitResponse.json();

      // Create or update the branch reference
      if (branchExists) {
        // Update existing branch
        console.log(
          `Updating existing branch '${branch}' to point to commit: ${newCommit.sha.slice(0, 7)}...`
        );
        const updateRefResponse = await fetch(
          `${apiBaseUrl}/repos/${owner}/${repo}/git/refs/heads/${branch}`,
          {
            method: "PATCH",
            headers,
            body: JSON.stringify({
              sha: newCommit.sha,
              force: false,
            }),
          }
        );

        if (!updateRefResponse.ok) {
          const errorText = await updateRefResponse.text();
          console.error(
            `GitHub API error (${updateRefResponse.status}): ${errorText}`
          );
          throw new Error(
            `Failed to update branch: ${updateRefResponse.status}. Details: ${errorText}`
          );
        }

        console.log(`Successfully updated branch '${branch}'`);
      } else {
        // Create new branch
        console.log(
          `Creating new branch '${branch}' pointing to commit: ${newCommit.sha.slice(0, 7)}...`
        );
        const createRefResponse = await fetch(
          `${apiBaseUrl}/repos/${owner}/${repo}/git/refs`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              ref: `refs/heads/${branch}`,
              sha: newCommit.sha,
            }),
          }
        );

        if (!createRefResponse.ok) {
          const errorText = await createRefResponse.text();
          console.error(
            `GitHub API error (${createRefResponse.status}): ${errorText}`
          );
          throw new Error(
            `Failed to create branch: ${createRefResponse.status}. Details: ${errorText}`
          );
        }

        console.log(`Successfully created new branch '${branch}'`);
      }

      return `Successfully published ${Object.keys(files).length} files to GitHub repository ${owner}/${repo} on branch ${branch}.`;
    } catch (error) {
      console.error("Error publishing to GitHub:", error);
      return `Error publishing to GitHub: ${error instanceof Error ? error.message : String(error)}`;
    }
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
    try {
      const agent = agentContext.getStore();
      if (!agent) {
        throw new Error("Agent context not found");
      }

      console.log("git state", agent.state);

      // Get GitHub configuration from agent state
      const currentState = agent.state || {};
      const github = currentState.github;
      if (!github || !github.owner || !github.branch) {
        return "GitHub configuration (owner, branch) not found in agent state.";
      }
      const owner = github.owner;
      const repo = currentState.agentName; // Use agentName as repo name
      const branch = github.branch;

      if (!repo) {
        return "Agent name (used as repository name) not found in agent state.";
      }

      console.log(
        `Syncing files from GitHub: ${owner}/${repo}/${branch}${path ? `/${path}` : ""}`
      );

      // Get token from environment
      const authToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
      if (!authToken) {
        return "GitHub token not provided and GITHUB_PERSONAL_ACCESS_TOKEN environment variable not set.";
      }

      // Setup common headers for GitHub API requests
      const headers = {
        Accept: "application/vnd.github.v3+json",
        Authorization: `token ${authToken}`,
        "User-Agent": "WebsyteAI-Agent", // Required by GitHub API
      };

      // Base URL for GitHub API
      const apiBaseUrl = "https://api.github.com";

      // Define types for GitHub API responses
      type GitHubFileContent = {
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
      };

      type GitHubDirectoryItem = {
        name: string;
        path: string;
        sha: string;
        size: number;
        url: string;
        html_url: string;
        git_url: string;
        download_url: string | null;
        type: "file" | "dir";
      };

      type GitHubContent = GitHubFileContent | GitHubDirectoryItem[];

      // Type for our file system structure
      type FileSystemRecord = Record<
        string,
        {
          content: string;
          created: string;
          modified: string;
          streaming: boolean;
        }
      >;

      // Function to recursively fetch files from a directory
      async function fetchDirectoryContents(
        repoPath = ""
      ): Promise<FileSystemRecord> {
        const encodedPath = repoPath ? encodeURIComponent(repoPath) : "";
        const url = `${apiBaseUrl}/repos/${owner}/${repo}/contents/${encodedPath}?ref=${branch}`;

        console.log(`Fetching contents from: ${url}`);

        const response = await fetch(url, {
          method: "GET",
          headers,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`GitHub API error (${response.status}): ${errorText}`);
          throw new Error(
            `Failed to fetch repository contents: ${response.status}. Details: ${errorText}`
          );
        }

        const contents = (await response.json()) as GitHubContent;

        // If contents is an array, it's a directory
        if (Array.isArray(contents)) {
          let files: FileSystemRecord = {};

          // Process each item in the directory
          for (const item of contents) {
            if (item.type === "file") {
              // Fetch file content
              const fileResponse = await fetch(item.url, {
                method: "GET",
                headers,
              });

              if (!fileResponse.ok) {
                console.error(
                  `Failed to fetch file ${item.path}: ${fileResponse.status}`
                );
                continue;
              }

              const fileData = (await fileResponse.json()) as GitHubFileContent;
              const content = Buffer.from(fileData.content, "base64").toString(
                "utf-8"
              );

              // Add file to our files object
              files[item.path] = {
                content,
                created: new Date().toISOString(), // We don't have creation date from GitHub
                modified: new Date().toISOString(),
                streaming: false,
              };

              console.log(`Synced file: ${item.path}`);
            } else if (item.type === "dir") {
              // Recursively fetch directory contents
              const subDirFiles = await fetchDirectoryContents(item.path);
              files = { ...files, ...subDirFiles };
            }
          }

          return files;
        } else {
          // Single file response
          const content = Buffer.from(contents.content, "base64").toString(
            "utf-8"
          );

          return {
            [contents.path]: {
              content,
              created: new Date().toISOString(),
              modified: new Date().toISOString(),
              streaming: false,
            },
          };
        }
      }

      // Start fetching from the specified path or root
      const syncedFiles = await fetchDirectoryContents(path);

      if (Object.keys(syncedFiles).length === 0) {
        return `No files found in ${owner}/${repo}/${branch}${path ? `/${path}` : ""}.`;
      }

      // Update agent state with the synced files
      // This completely replaces the existing files with the ones from GitHub
      await agent.setState({ files: syncedFiles });

      return `Successfully synced ${Object.keys(syncedFiles).length} files from GitHub repository ${owner}/${repo} on branch ${branch}.`;
    } catch (error) {
      console.error("Error syncing from GitHub:", error);
      return `Error syncing from GitHub: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

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

      console.log(`Getting build status for ${owner}/${repo}@${ref}`);

      // Base URL for GitHub API
      const apiBaseUrl = "https://api.github.com";

      // Get combined status for the reference
      const statusUrl = `${apiBaseUrl}/repos/${owner}/${repo}/commits/${ref}/status`;
      console.log(`Fetching status from: ${statusUrl}`);

      const statusResponse = await fetch(statusUrl, {
        method: "GET",
        headers,
      });

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        console.error(
          `GitHub API error (${statusResponse.status}): ${errorText}`
        );
        return {
          success: false,
          message: `Failed to get build status: ${statusResponse.status}. Details: ${errorText}`,
        };
      }

      const statusData = await statusResponse.json();

      // Get check runs for the reference (more detailed information)
      const checksUrl = `${apiBaseUrl}/repos/${owner}/${repo}/commits/${ref}/check-runs`;
      console.log(`Fetching check runs from: ${checksUrl}`);

      // Add v3 checks API header
      const checksHeaders = {
        ...headers,
        Accept: "application/vnd.github.v3+json",
      };

      const checksResponse = await fetch(checksUrl, {
        method: "GET",
        headers: checksHeaders,
      });

      let checksData = null;
      if (checksResponse.ok) {
        checksData = await checksResponse.json();
      } else {
        console.warn(`Could not fetch check runs: ${checksResponse.status}`);
      }

      // Combine status and checks data
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
          app: {
            name: run.app.name,
          },
        }));
      }

      // Update agent state if requested
      if (updateAgentState) {
        try {
          const agent = agentContext.getStore();
          if (!agent) {
            console.warn("Agent context not found, cannot update state");
          } else {
            const currentState = agent.state || {};

            // Create a new state object with the build status
            await agent.setState({
              ...currentState,
              buildStatus: {
                repository: `${owner}/${repo}`,
                ref,
                status: buildStatus,
                timestamp: new Date().toISOString(),
              },
            });

            console.log("Updated agent state with build status information");
          }
        } catch (stateError) {
          console.error("Error updating agent state:", stateError);
        }
      }

      // Prepare a human-readable summary
      const summary = {
        repository: `${owner}/${repo}`,
        ref,
        state: buildStatus.state,
        statusCount: buildStatus.statuses.length,
        checkRunsCount: buildStatus.check_runs?.length || 0,
        failedStatuses: buildStatus.statuses.filter(
          (s) => s.state !== "success"
        ).length,
        failedCheckRuns:
          buildStatus.check_runs?.filter(
            (c) => c.conclusion !== "success" && c.status === "completed"
          ).length || 0,
        pendingCheckRuns:
          buildStatus.check_runs?.filter((c) => c.status !== "completed")
            .length || 0,
      };

      return {
        success: true,
        message: `Successfully retrieved build status for ${owner}/${repo}@${ref}`,
        summary,
        buildStatus,
      };
    } catch (error) {
      console.error("Error getting GitHub build status:", error);
      return {
        success: false,
        message: `Error getting GitHub build status: ${error instanceof Error ? error.message : String(error)}`,
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
 * Tool to revert the agent's state to a specific commit from the configured repository
 */
export const revertToCommit = tool({
  description:
    "Sync files from a specific commit in the configured GitHub repository to the agent's state.",
  parameters: z.object({
    commitSha: z.string().describe("The SHA of the commit to revert to"),
  }),
  execute: async ({ commitSha }) => {
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

      console.log(`Reverting to commit: ${commitSha} in ${owner}/${repo}`);

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

      // First, get the commit to verify it exists
      const commitUrl = `${apiBaseUrl}/repos/${owner}/${repo}/commits/${commitSha}`;
      console.log(`Fetching commit details from: ${commitUrl}`);

      const commitResponse = await fetch(commitUrl, {
        method: "GET",
        headers,
      });

      if (!commitResponse.ok) {
        const errorText = await commitResponse.text();
        console.error(
          `GitHub API error (${commitResponse.status}): ${errorText}`
        );
        return {
          success: false,
          message: `Failed to get commit: ${commitResponse.status}. Details: ${errorText}`,
        };
      }

      // Get the commit tree
      const commit = await commitResponse.json();
      const treeSha = commit.commit.tree.sha;

      // Get the tree with recursive=1 to get all files
      const treeUrl = `${apiBaseUrl}/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`;
      console.log(`Fetching tree from: ${treeUrl}`);

      const treeResponse = await fetch(treeUrl, {
        method: "GET",
        headers,
      });

      if (!treeResponse.ok) {
        const errorText = await treeResponse.text();
        console.error(
          `GitHub API error (${treeResponse.status}): ${errorText}`
        );
        return {
          success: false,
          message: `Failed to get tree: ${treeResponse.status}. Details: ${errorText}`,
        };
      }

      const tree = await treeResponse.json();

      // Process each file in the tree
      const files: Record<string, FileRecord> = {};

      for (const item of tree.tree) {
        // Only process blobs (files)
        if (item.type === "blob") {
          // Get the file content
          const contentUrl = `${apiBaseUrl}/repos/${owner}/${repo}/git/blobs/${item.sha}`;
          console.log(`Fetching content for: ${item.path}`);

          const contentResponse = await fetch(contentUrl, {
            method: "GET",
            headers,
          });

          if (!contentResponse.ok) {
            console.warn(
              `Failed to get content for ${item.path}: ${contentResponse.status}`
            );
            continue;
          }

          const content = await contentResponse.json();

          // GitHub returns base64 encoded content
          const decodedContent = Buffer.from(
            content.content,
            "base64"
          ).toString("utf-8");

          // Add file to our files object
          files[item.path] = {
            content: decodedContent,
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            streaming: false,
          };
        }
      }

      if (Object.keys(files).length === 0) {
        return {
          success: false,
          message: `No files found in commit ${commitSha}.`,
        };
      }

      // Update agent state with the files from this commit
      await agent.setState({
        ...currentState,
        files,
      });

      return {
        success: true,
        message: `Successfully reverted to commit ${commitSha} with ${Object.keys(files).length} files.`,
        commitDetails: {
          sha: commit.sha,
          message: commit.commit.message,
          author: commit.commit.author,
          date: commit.commit.author.date,
        },
      };
    } catch (error) {
      console.error("Error reverting to commit:", error);
      return {
        success: false,
        message: `Error reverting to commit: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});

// Export all GitHub tools
export const githubTools = {
  createGitHubRepository,
  checkGitHubRepository,
  publishToGitHub,
  syncFromGitHub,
  getGitHubBuildStatus,
  getCommitHistory,
  revertToCommit,
};
