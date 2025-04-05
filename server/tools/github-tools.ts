/**
 * GitHub tools for the AI chat agent
 * Handles GitHub repository operations
 */
import { tool } from "ai";
import { z } from "zod";
import { agentContext } from "../agent";
import type { GitHubFileContent, GitHubDirectoryItem, GitHubContent, FileRecord } from "../types";

/**
 * Tool to publish files to GitHub
 */
export const publishToGitHub = tool({
  description: "Publish files from the agent's state to a GitHub repository",
  parameters: z.object({
    owner: z
      .string()
      .describe("GitHub username or organization name that owns the repository"),
    repo: z.string().describe("GitHub repository name"),
    branch: z
      .string()
      .optional()
      .default("main")
      .describe("Branch to push to (default: main)"),
    commitMessage: z.string().describe("Commit message for the changes"),
    token: z
      .string()
      .optional()
      .describe(
        "GitHub personal access token (if not provided, will use environment variable)"
      ),
  }),
  execute: async ({
    owner,
    repo,
    branch = "main",
    commitMessage,
    token,
  }) => {
    try {
      const agent = agentContext.getStore();
      if (!agent) {
        throw new Error("Agent context not found");
      }

      // Get files from agent state
      const currentState = agent.state || {};
      const files = currentState.files || {};

      console.log("Publishing files to GitHub:", files);

      if (Object.keys(files).length === 0) {
        return "No files to publish. Create some files first.";
      }

      // Use provided token or get from environment
      const authToken = token || process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
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
      
      console.log("Using GitHub API with token", authToken ? "****" + authToken.slice(-4) : "none");

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
        const repoResponse = await fetch(`${apiBaseUrl}/repos/${owner}/${repo}`, {
          method: "GET",
          headers,
        });
        
        if (!repoResponse.ok) {
          const errorText = await repoResponse.text();
          console.error(`GitHub API error (${repoResponse.status}): ${errorText}`);
          throw new Error(`Failed to get repository: ${repoResponse.status} ${repoResponse.statusText}. Details: ${errorText}`);
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
            console.error(`GitHub API error (${refResponse.status}): ${errorText}`);
            throw new Error(`Branch not found: ${refResponse.status}. Details: ${errorText}`);
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
            console.error(`GitHub API error (${commitResponse.status}): ${errorText}`);
            throw new Error(`Failed to get commit: ${commitResponse.status}. Details: ${errorText}`);
          }
          
          const baseCommit = await commitResponse.json();
          baseTreeSha = baseCommit.tree.sha;
        } catch (branchError) {
          // Branch doesn't exist, use the default branch as base
          console.log(`Branch '${branch}' not found, will create it using default branch as base`);
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
            console.error(`GitHub API error (${defaultBranchResponse.status}): ${errorText}`);
            throw new Error(`Failed to get default branch: ${defaultBranchResponse.status}. Details: ${errorText}`);
          }
          
          const defaultBranchData = await defaultBranchResponse.json();
          baseCommitSha = defaultBranchData.object.sha;
          
          // Get the base tree
          console.log(`Getting commit details for default branch SHA: ${baseCommitSha}`);
          const baseCommitResponse = await fetch(
            `${apiBaseUrl}/repos/${owner}/${repo}/git/commits/${baseCommitSha}`,
            {
              method: "GET",
              headers,
            }
          );
          
          if (!baseCommitResponse.ok) {
            const errorText = await baseCommitResponse.text();
            console.error(`GitHub API error (${baseCommitResponse.status}): ${errorText}`);
            throw new Error(`Failed to get base commit: ${baseCommitResponse.status}. Details: ${errorText}`);
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
            console.error(`GitHub API error (${blobResponse.status}): ${errorText}`);
            throw new Error(`Failed to create blob for ${path}: ${blobResponse.status}. Details: ${errorText}`);
          }
          
          const data = await blobResponse.json();
          console.log(`Blob created for ${path} with SHA: ${data.sha.slice(0, 7)}...`);

          return {
            path,
            mode: "100644", // Regular file
            type: "blob",
            sha: data.sha,
          };
        })
      );

      // Create a new tree with the file blobs
      console.log(`Creating tree with ${fileBlobs.length} blobs, base tree: ${baseTreeSha.slice(0, 7)}...`);
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
        console.error(`GitHub API error (${treeResponse.status}): ${errorText}`);
        throw new Error(`Failed to create tree: ${treeResponse.status}. Details: ${errorText}`);
      }
      
      const newTree = await treeResponse.json();

      // Create a new commit
      console.log(`Creating commit with message: "${commitMessage}", tree: ${newTree.sha.slice(0, 7)}...`);
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
        console.error(`GitHub API error (${commitResponse.status}): ${errorText}`);
        throw new Error(`Failed to create commit: ${commitResponse.status}. Details: ${errorText}`);
      }
      
      const newCommit = await commitResponse.json();

      // Create or update the branch reference
      if (branchExists) {
        // Update existing branch
        console.log(`Updating existing branch '${branch}' to point to commit: ${newCommit.sha.slice(0, 7)}...`);
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
          console.error(`GitHub API error (${updateRefResponse.status}): ${errorText}`);
          throw new Error(`Failed to update branch: ${updateRefResponse.status}. Details: ${errorText}`);
        }
        
        console.log(`Successfully updated branch '${branch}'`);
      } else {
        // Create new branch
        console.log(`Creating new branch '${branch}' pointing to commit: ${newCommit.sha.slice(0, 7)}...`);
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
          console.error(`GitHub API error (${createRefResponse.status}): ${errorText}`);
          throw new Error(`Failed to create branch: ${createRefResponse.status}. Details: ${errorText}`);
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
  description: "Sync files from a GitHub repository to the agent's state (repo is source of truth)",
  parameters: z.object({
    owner: z
      .string()
      .describe("GitHub username or organization name that owns the repository"),
    repo: z.string().describe("GitHub repository name"),
    branch: z
      .string()
      .optional()
      .default("main")
      .describe("Branch to pull from (default: main)"),
    path: z
      .string()
      .optional()
      .describe("Optional path within the repository to sync (default: entire repo)"),
    token: z
      .string()
      .optional()
      .describe(
        "GitHub personal access token (if not provided, will use environment variable)"
      ),
  }),
  execute: async ({
    owner,
    repo,
    branch = "main",
    path = "",
    token,
  }) => {
    try {
      const agent = agentContext.getStore();
      if (!agent) {
        throw new Error("Agent context not found");
      }

      console.log(`Syncing files from GitHub: ${owner}/${repo}/${branch}${path ? `/${path}` : ''}`);

      // Use provided token or get from environment
      const authToken = token || process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
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
      type FileSystemRecord = Record<string, {
        content: string;
        created: string;
        modified: string;
        streaming: boolean;
      }>;

      // Function to recursively fetch files from a directory
      async function fetchDirectoryContents(repoPath = ""): Promise<FileSystemRecord> {
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
          throw new Error(`Failed to fetch repository contents: ${response.status}. Details: ${errorText}`);
        }
        
        const contents = await response.json() as GitHubContent;
        
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
                console.error(`Failed to fetch file ${item.path}: ${fileResponse.status}`);
                continue;
              }
              
              const fileData = await fileResponse.json() as GitHubFileContent;
              const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
              
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
          const content = Buffer.from(contents.content, 'base64').toString('utf-8');
          
          return {
            [contents.path]: {
              content,
              created: new Date().toISOString(),
              modified: new Date().toISOString(),
              streaming: false,
            }
          };
        }
      }

      // Start fetching from the specified path or root
      const syncedFiles = await fetchDirectoryContents(path);
      
      if (Object.keys(syncedFiles).length === 0) {
        return `No files found in ${owner}/${repo}/${branch}${path ? `/${path}` : ''}.`;
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
 * Tool to create a new GitHub repository
 */
export const createGitHubRepository = tool({
  description: "Create a new GitHub repository for a user or organization",
  parameters: z.object({
    name: z
      .string()
      .describe("Name of the repository to create"),
    description: z
      .string()
      .optional()
      .describe("Description of the repository"),
    private: z
      .boolean()
      .optional()
      .default(false)
      .describe("Whether the repository should be private (default: false)"),
    org: z
      .string()
      .optional()
      .describe("Optional: organization name to create the repository in. If not provided, creates in the user's account"),
    autoInit: z
      .boolean()
      .optional()
      .default(true)
      .describe("Initialize the repository with a README (default: true)"),
    token: z
      .string()
      .optional()
      .describe(
        "GitHub personal access token (if not provided, will use environment variable)"
      ),
  }),
  execute: async ({
    name,
    description = "",
    private: isPrivate = false,
    org,
    autoInit = true,
    token,
  }) => {
    try {
      // Use provided token or get from environment
      const authToken = token || process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
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
      
      console.log("Using GitHub API with token", authToken ? "****" + authToken.slice(-4) : "none");

      // Base URL for GitHub API
      const apiBaseUrl = "https://api.github.com";
      
      // Determine if creating in user account or organization
      const endpoint = org 
        ? `${apiBaseUrl}/orgs/${org}/repos` 
        : `${apiBaseUrl}/user/repos`;
      
      console.log(`Creating repository ${name}${org ? ` in organization ${org}` : ''}`);
      
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
        throw new Error(`Failed to create repository: ${response.status} ${response.statusText}. Details: ${errorText}`);
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
        }
      };
    } catch (error) {
      console.error("Error creating GitHub repository:", error);
      return {
        success: false,
        message: `Error creating GitHub repository: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  },
});

/**
 * Tool to check if a GitHub repository exists
 */
export const checkGitHubRepository = tool({
  description: "Check if a GitHub repository exists and get its information",
  parameters: z.object({
    owner: z
      .string()
      .describe("GitHub username or organization name that owns the repository"),
    repo: z
      .string()
      .describe("GitHub repository name to check"),
    token: z
      .string()
      .optional()
      .describe(
        "GitHub personal access token (if not provided, will use environment variable)"
      ),
  }),
  execute: async ({
    owner,
    repo,
    token,
  }) => {
    try {
      // Use provided token or get from environment
      const authToken = token || process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
      if (!authToken) {
        return "GitHub token not provided and GITHUB_PERSONAL_ACCESS_TOKEN environment variable not set.";
      }

      // Setup common headers for GitHub API requests
      const headers = {
        Accept: "application/vnd.github.v3+json",
        Authorization: `token ${authToken}`,
        "User-Agent": "WebsyteAI-Agent", // Required by GitHub API
      };
      
      console.log("Using GitHub API with token", authToken ? "****" + authToken.slice(-4) : "none");

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
          message: `Repository ${owner}/${repo} does not exist or you don't have access to it.`
        };
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`GitHub API error (${response.status}): ${errorText}`);
        return {
          exists: false,
          error: true,
          message: `Error checking repository: ${response.status} ${response.statusText}. Details: ${errorText}`
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
        }
      };
    } catch (error) {
      console.error("Error checking GitHub repository:", error);
      return {
        exists: false,
        error: true,
        message: `Error checking GitHub repository: ${error instanceof Error ? error.message : String(error)}`
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
};
