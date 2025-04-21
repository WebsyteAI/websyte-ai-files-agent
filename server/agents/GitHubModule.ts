// websyte-ai-files-agent/server/agents/GitHubModule.ts
import type { AgentState } from "../types";

export class GitHubModule {
  agent: any;

  constructor(agentContext: any) {
    this.agent = agentContext;
  }

  async publishFiles(commitMessage: string) {
    const files = this.agent.state.files || {};
    const github = this.agent.state.github;
    if (!github || !github.owner || !github.branch) {
      return "GitHub configuration (owner, branch) not found in agent state.";
    }
    const owner = github.owner;
    const repo = this.agent.state.agentName;
    const branch = github.branch;
    if (!repo) {
      return "Agent name (used as repository name) not found in agent state.";
    }
    if (Object.keys(files).length === 0) {
      return "No files to publish. Create some files first.";
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
              content: (fileData as any).content,
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
  }

  async syncFiles(path: string = "") {
    const agent = this.agent;
    if (!agent) throw new Error("Agent context not found");
    const github = this.agent.state.github;
    if (!github || !github.owner || !github.branch) {
      return "GitHub configuration (owner, branch) not found in agent state.";
    }
    const owner = github.owner;
    const repo = this.agent.state.agentName;
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
    const fetchDirectoryContents = async (repoPath = ""): Promise<Record<string, any>> => {
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
        let files: Record<string, any> = {};
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
    await this.agent.setState({
      ...this.agent.state,
      files: syncedFiles,
    });
    return `Successfully synced ${Object.keys(syncedFiles).length} files from GitHub repository ${owner}/${repo} on branch ${branch}.`;
  }

  async revertToCommit(commitSha: string) {
    const github = this.agent.state.github;
    const owner = github?.owner;
    const repo = this.agent.state.agentName;
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
    const files: Record<string, any> = {};
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
    await this.agent.setState({
      ...this.agent.state,
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
  }

  async deleteFile(path: string, commitMessage: string) {
    const github = this.agent.state.github;
    if (!github || !github.owner || !github.branch) {
      return "GitHub configuration (owner, branch) not found in agent state.";
    }
    const owner = github.owner;
    const repo = this.agent.state.agentName;
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
    if (this.agent.state.files && this.agent.state.files[path]) {
      const updatedFiles = { ...this.agent.state.files };
      delete updatedFiles[path];
      await this.agent.setState({
        ...this.agent.state,
        files: updatedFiles,
      });
    }
    return `Successfully deleted file ${path} from GitHub repository ${owner}/${repo} on branch ${branch}.`;
  }

  async createRepository({
    description = "",
    private: isPrivate = false,
    autoInit = true,
  }: {
    description?: string;
    private?: boolean;
    autoInit?: boolean;
  }) {
    const github = this.agent.state.github;
    const owner = github?.owner;
    const name = this.agent.state.agentName;
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
  }

  async checkRepository() {
    const github = this.agent.state.github;
    const owner = github?.owner;
    const repo = this.agent.state.agentName;
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
  }

  async getBuildStatus(ref: string, updateAgentState: boolean = false) {
    const github = this.agent.state.github;
    const owner = github?.owner;
    const repo = this.agent.state.agentName;
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
    const checksHeaders = { ...headers, Accept: "application/vnd.github.v3+json" };
    const checksResponse = await fetch(checksUrl, { method: "GET", headers: checksHeaders });
    let checksData = null;
    if (checksResponse.ok) {
      checksData = await checksResponse.json();
    }
    const buildStatus: any = {
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
      await this.agent.setState({
        ...this.agent.state,
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
  }

  async getCommitHistory(
    branch?: string,
    perPage: number = 10,
    page: number = 1,
    includeBuildStatus: boolean = true,
    updateAgentState: boolean = true
  ) {
    const github = this.agent.state.github;
    const owner = github?.owner;
    const repo = this.agent.state.agentName;
    const stateBranch = github?.branch;
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
    const branchName = branch || stateBranch || "main";
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
    const commitsUrl = `${apiBaseUrl}/repos/${owner}/${repo}/commits?sha=${branchName}&per_page=${perPage}&page=${page}`;
    const commitsResponse = await fetch(commitsUrl, { method: "GET", headers });
    if (!commitsResponse.ok) {
      const errorText = await commitsResponse.text();
      return {
        success: false,
        message: `Failed to get commit history: ${commitsResponse.status}. Details: ${errorText}`,
      };
    }
    const commits = await commitsResponse.json();
    if (includeBuildStatus) {
      for (const commit of commits) {
        try {
          const statusUrl = `${apiBaseUrl}/repos/${owner}/${repo}/commits/${commit.sha}/status`;
          const statusResponse = await fetch(statusUrl, { method: "GET", headers });
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            commit.status = {
              state: statusData.state,
              total_count: statusData.total_count,
              statuses: statusData.statuses,
            };
          } else {
            commit.status = { state: "pending" };
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch {
          commit.status = { state: "pending" };
        }
      }
    }
    if (updateAgentState) {
      await this.agent.setState({
        ...this.agent.state,
        commitHistory: {
          repository: `${owner}/${repo}`,
          branch: branchName,
          commits,
          timestamp: new Date().toISOString(),
        },
      });
    }
    return {
      success: true,
      message: `Successfully retrieved ${commits.length} commits from ${owner}/${repo}/${branchName}`,
      commits,
    };
  }

  async getBuildLogs(ref: string, checkRunId?: string, updateAgentState: boolean = false) {
    const github = this.agent.state.github;
    const owner = github?.owner;
    const repo = this.agent.state.agentName;
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
    let targetCheckRunId = checkRunId;
    if (!targetCheckRunId) {
      const checksUrl = `${apiBaseUrl}/repos/${owner}/${repo}/commits/${ref}/check-runs`;
      const checksHeaders = { ...headers, Accept: "application/vnd.github.v3+json" };
      const checksResponse = await fetch(checksUrl, { method: "GET", headers: checksHeaders });
      if (!checksResponse.ok) {
        const errorText = await checksResponse.text();
        return {
          success: false,
          message: `Failed to get check runs: ${checksResponse.status}. Details: ${errorText}`,
        };
      }
      const checksData = await checksResponse.json();
      const failedCheckRun = checksData.check_runs?.find(
        (run: any) => run.conclusion === "failure" && run.status === "completed"
      );
      if (!failedCheckRun) {
        return {
          success: false,
          message: `No failed check runs found for ${owner}/${repo}@${ref}`,
        };
      }
      targetCheckRunId = failedCheckRun.id;
    }
    const logsUrl = `${apiBaseUrl}/repos/${owner}/${repo}/check-runs/${targetCheckRunId}/logs`;
    const logsResponse = await fetch(logsUrl, {
      method: "GET",
      headers: { ...headers, Accept: "application/vnd.github.v3.raw" },
      redirect: "follow",
    });
    let logs: string;
    if (logsResponse.status === 302 || logsResponse.status === 307) {
      const redirectUrl = logsResponse.headers.get("location");
      if (!redirectUrl) {
        return {
          success: false,
          message: "Received redirect response but no location header",
        };
      }
      // Fetch the logs from the redirect URL
      const redirectResponse = await fetch(redirectUrl);
      if (!redirectResponse.ok) {
        return {
          success: false,
          message: `Failed to fetch logs from redirect URL: ${redirectResponse.status}`,
        };
      }
      logs = await redirectResponse.text();
    } else if (logsResponse.ok) {
      logs = await logsResponse.text();
    } else {
      const errorText = await logsResponse.text();
      return {
        success: false,
        message: `Failed to get logs: ${logsResponse.status}. Details: ${errorText}`,
      };
    }
    // Update agent state if requested
    if (updateAgentState) {
      await this.agent.setState({
        ...this.agent.state,
        buildLogs: {
          repository: `${owner}/${repo}`,
          ref,
          checkRunId: String(targetCheckRunId),
          logs,
          timestamp: new Date().toISOString(),
        },
      });
    }
    return {
      success: true,
      message: `Successfully retrieved logs for check run ${targetCheckRunId}`,
      logs,
    };
  }
}
