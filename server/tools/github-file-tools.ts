/**
 * GitHub file tools for the AI chat agent
 * Handles file operations with GitHub repositories
 */
import { tool } from "ai";
import { z } from "zod";
import { agentContext } from "../agent";
import type { FileRecord } from "../types";

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
      console.log("Starting publishFiles with commit message:", commitMessage);
      
      const agent = agentContext.getStore();
      if (!agent) throw new Error("Agent context not found");
      
      // Check for files in agent state
      const files = agent.state.files || {};
      console.log(`Found ${Object.keys(files).length} files in agent state`);
      
      // Check GitHub configuration
      const github = agent.state.github;
      if (!github) {
        console.error("GitHub configuration not found in agent state");
        return "GitHub configuration not found in agent state.";
      }
      
      if (!github.owner) {
        console.error("GitHub owner not found in configuration");
        return "GitHub owner not found in configuration.";
      }
      
      if (!github.branch) {
        console.error("GitHub branch not found in configuration");
        return "GitHub branch not found in configuration.";
      }
      
      const owner = github.owner;
      const repo = agent.state.agentName;
      const branch = github.branch;
      
      console.log(`Publishing to ${owner}/${repo} on branch ${branch}`);
      
      if (!repo) {
        console.error("Agent name (used as repository name) not found in agent state");
        return "Agent name (used as repository name) not found in agent state.";
      }
      
      if (Object.keys(files).length === 0) {
        console.error("No files to publish");
        return "No files to publish. Create some files first.";
      }
      
      const authToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
      if (!authToken) {
        console.error("GitHub token not provided");
        return "GitHub token not provided and GITHUB_PERSONAL_ACCESS_TOKEN environment variable not set.";
      }
      
      const headers = {
        Accept: "application/vnd.github.v3+json",
        Authorization: `token ${authToken}`,
        "Content-Type": "application/json",
        "User-Agent": "WebsyteAI-Agent",
      };
      
      const apiBaseUrl = "https://api.github.com";
      let baseCommitSha;
      let baseTreeSha;
      let branchExists = true;
      let defaultBranch;
      
      try {
        const repoResponse = await fetch(
          `${apiBaseUrl}/repos/${owner}/${repo}`,
          { method: "GET", headers }
        );
        
        if (!repoResponse.ok) {
          const errorText = await repoResponse.text();
          throw new Error(
            `Failed to get repository: ${repoResponse.status} ${repoResponse.statusText}. Details: ${errorText}`
          );
        }
        
        const repoData = await repoResponse.json();
        defaultBranch = repoData.default_branch;
        
        try {
          const refResponse = await fetch(
            `${apiBaseUrl}/repos/${owner}/${repo}/git/refs/heads/${branch}`,
            { method: "GET", headers }
          );
          
          if (!refResponse.ok) {
            const errorText = await refResponse.text();
            throw new Error(
              `Branch not found: ${refResponse.status}. Details: ${errorText}`
            );
          }
          
          const refData = await refResponse.json();
          baseCommitSha = refData.object.sha;
          
          const commitResponse = await fetch(
            `${apiBaseUrl}/repos/${owner}/${repo}/git/commits/${baseCommitSha}`,
            { method: "GET", headers }
          );
          
          if (!commitResponse.ok) {
            const errorText = await commitResponse.text();
            throw new Error(
              `Failed to get commit: ${commitResponse.status}. Details: ${errorText}`
            );
          }
          
          const baseCommit = await commitResponse.json();
          baseTreeSha = baseCommit.tree.sha;
        } catch {
          branchExists = false;
          const defaultBranchResponse = await fetch(
            `${apiBaseUrl}/repos/${owner}/${repo}/git/refs/heads/${defaultBranch}`,
            { method: "GET", headers }
          );
          
          if (!defaultBranchResponse.ok) {
            const errorText = await defaultBranchResponse.text();
            throw new Error(
              `Failed to get default branch: ${defaultBranchResponse.status}. Details: ${errorText}`
            );
          }
          
          const defaultBranchData = await defaultBranchResponse.json();
          baseCommitSha = defaultBranchData.object.sha;
          
          const baseCommitResponse = await fetch(
            `${apiBaseUrl}/repos/${owner}/${repo}/git/commits/${baseCommitSha}`,
            { method: "GET", headers }
          );
          
          if (!baseCommitResponse.ok) {
            const errorText = await baseCommitResponse.text();
            throw new Error(
              `Failed to get base commit: ${baseCommitResponse.status}. Details: ${errorText}`
            );
          }
          
          const baseCommit = await baseCommitResponse.json();
          baseTreeSha = baseCommit.tree.sha;
        }
      } catch (error) {
        return `Error: Could not get repository information. Make sure the repository exists and you have access to it.`;
      }
      
      const fileBlobs = await Promise.all(
        Object.entries(files).map(async ([path, fileData]) => {
          const blobResponse = await fetch(
            `${apiBaseUrl}/repos/${owner}/${repo}/git/blobs`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                content: (fileData as FileRecord).content,
                encoding: "utf-8",
              }),
            }
          );
          
          if (!blobResponse.ok) {
            const errorText = await blobResponse.text();
            throw new Error(
              `Failed to create blob for ${path}: ${blobResponse.status}. Details: ${errorText}`
            );
          }
          
          const data = await blobResponse.json();
          return {
            path,
            mode: "100644",
            type: "blob",
            sha: data.sha,
          };
        })
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
        throw new Error(
          `Failed to create tree: ${treeResponse.status}. Details: ${errorText}`
        );
      }
      
      const newTree = await treeResponse.json();
      
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
        throw new Error(
          `Failed to create commit: ${commitResponse.status}. Details: ${errorText}`
        );
      }
      
      const newCommit = await commitResponse.json();
      
      if (branchExists) {
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
          throw new Error(
            `Failed to update branch: ${updateRefResponse.status}. Details: ${errorText}`
          );
        }
      } else {
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
          throw new Error(
            `Failed to create branch: ${createRefResponse.status}. Details: ${errorText}`
          );
        }
      }
      
      return `Successfully published ${Object.keys(files).length} files to GitHub repository ${owner}/${repo} on branch ${branch}.`;
    } catch (error) {
      console.error("Error publishing files:", error);
      return `Error publishing files: ${error instanceof Error ? error.message : String(error)}`;
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
      if (!agent) throw new Error("Agent context not found");
      
      const github = agent.state.github;
      if (!github || !github.owner || !github.branch) {
        return "GitHub configuration (owner, branch) not found in agent state.";
      }
      
      const owner = github.owner;
      const repo = agent.state.agentName;
      const branch = github.branch;
      
      if (!repo) {
        return "Agent name (used as repository name) not found in agent state.";
      }
      
      const authToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
      if (!authToken) {
        return "GitHub token not provided and GITHUB_PERSONAL_ACCESS_TOKEN environment variable not set.";
      }
      
      const headers = {
        Accept: "application/vnd.github.v3+json",
        Authorization: `token ${authToken}`,
        "User-Agent": "WebsyteAI-Agent",
      };
      
      const apiBaseUrl = "https://api.github.com";
      
      const fetchDirectoryContents = async (repoPath = ""): Promise<Record<string, FileRecord>> => {
        const encodedPath = repoPath ? encodeURIComponent(repoPath) : "";
        const url = `${apiBaseUrl}/repos/${owner}/${repo}/contents/${encodedPath}?ref=${branch}`;
        const response = await fetch(url, { method: "GET", headers });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to fetch repository contents: ${response.status}. Details: ${errorText}`
          );
        }
        
        const contents = await response.json();
        
        if (Array.isArray(contents)) {
          let files: Record<string, FileRecord> = {};
          
          for (const item of contents) {
            if (item.type === "file") {
              const fileResponse = await fetch(item.url, { method: "GET", headers });
              if (!fileResponse.ok) continue;
              
              const fileData = await fileResponse.json();
              const content = Buffer.from(fileData.content, "base64").toString("utf-8");
              
              files[item.path] = {
                content,
                created: new Date().toISOString(),
                modified: new Date().toISOString(),
                streaming: false,
              };
            } else if (item.type === "dir") {
              const subDirFiles = await fetchDirectoryContents(item.path);
              files = { ...files, ...subDirFiles };
            }
          }
          
          return files;
        } else {
          const content = Buffer.from(contents.content, "base64").toString("utf-8");
          
          return {
            [contents.path]: {
              content,
              created: new Date().toISOString(),
              modified: new Date().toISOString(),
              streaming: false,
            },
          };
        }
      };
      
      const syncedFiles = await fetchDirectoryContents(path);
      
      if (Object.keys(syncedFiles).length === 0) {
        return `No files found in ${owner}/${repo}/${branch}${path ? `/${path}` : ""}.`;
      }
      
      await agent.setState({
        ...agent.state,
        files: syncedFiles,
      });
      
      return `Successfully synced ${Object.keys(syncedFiles).length} files from GitHub repository ${owner}/${repo} on branch ${branch}.`;
    } catch (error) {
      console.error("Error syncing files:", error);
      return `Error syncing files: ${error instanceof Error ? error.message : String(error)}`;
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
      const commitUrl = `${apiBaseUrl}/repos/${owner}/${repo}/commits/${commitSha}`;
      
      const commitResponse = await fetch(commitUrl, { method: "GET", headers });
      if (!commitResponse.ok) {
        const errorText = await commitResponse.text();
        return {
          success: false,
          message: `Failed to get commit: ${commitResponse.status}. Details: ${errorText}`,
        };
      }
      
      const commit = await commitResponse.json();
      const treeSha = commit.commit.tree.sha;
      
      const treeUrl = `${apiBaseUrl}/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`;
      const treeResponse = await fetch(treeUrl, { method: "GET", headers });
      
      if (!treeResponse.ok) {
        const errorText = await treeResponse.text();
        return {
          success: false,
          message: `Failed to get tree: ${treeResponse.status}. Details: ${errorText}`,
        };
      }
      
      const tree = await treeResponse.json();
      const files: Record<string, FileRecord> = {};
      
      for (const item of tree.tree) {
        if (item.type === "blob") {
          const contentUrl = `${apiBaseUrl}/repos/${owner}/${repo}/git/blobs/${item.sha}`;
          const contentResponse = await fetch(contentUrl, { method: "GET", headers });
          
          if (!contentResponse.ok) continue;
          
          const content = await contentResponse.json();
          const decodedContent = Buffer.from(content.content, "base64").toString("utf-8");
          
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
      
      await agent.setState({
        ...agent.state,
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
    try {
      const agent = agentContext.getStore();
      if (!agent) throw new Error("Agent context not found");
      
      const github = agent.state.github;
      if (!github || !github.owner || !github.branch) {
        return "GitHub configuration (owner, branch) not found in agent state.";
      }
      
      const owner = github.owner;
      const repo = agent.state.agentName;
      const branch = github.branch;
      
      if (!repo) {
        return "Agent name (used as repository name) not found in agent state.";
      }
      
      const authToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
      if (!authToken) {
        return "GitHub token not provided and GITHUB_PERSONAL_ACCESS_TOKEN environment variable not set.";
      }
      
      const headers = {
        Accept: "application/vnd.github.v3+json",
        Authorization: `token ${authToken}`,
        "Content-Type": "application/json",
        "User-Agent": "WebsyteAI-Agent",
      };
      
      const apiBaseUrl = "https://api.github.com";
      const fileUrl = `${apiBaseUrl}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
      
      const fileResponse = await fetch(fileUrl, { method: "GET", headers });
      if (!fileResponse.ok) {
        const errorText = await fileResponse.text();
        return `File not found or cannot be accessed: ${path}. Status: ${fileResponse.status}`;
      }
      
      const fileData = await fileResponse.json();
      const fileSha = fileData.sha;
      
      const deleteResponse = await fetch(fileUrl, {
        method: "DELETE",
        headers,
        body: JSON.stringify({
          message: commitMessage,
          sha: fileSha,
          branch: branch,
        }),
      });
      
      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        return `Failed to delete file: ${deleteResponse.status}. Details: ${errorText}`;
      }
      
      if (agent.state.files && agent.state.files[path]) {
        const updatedFiles = { ...agent.state.files };
        delete updatedFiles[path];
        
        await agent.setState({
          ...agent.state,
          files: updatedFiles,
        });
      }
      
      return `Successfully deleted file ${path} from GitHub repository ${owner}/${repo} on branch ${branch}.`;
    } catch (error) {
      console.error("Error deleting file:", error);
      return `Error deleting file: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

// Export all GitHub file tools
export const githubFileTools = {
  publishToGitHub,
  syncFromGitHub,
  revertToCommit,
  deleteFileFromGitHub,
};
