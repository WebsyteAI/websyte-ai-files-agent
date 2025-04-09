/**
 * GitHub tools for the AI chat agent
 * Re-exports tools from specialized GitHub modules
 */

// Import tools from specialized modules
import { githubRepoTools } from "./github-repo-tools";
import { githubFileTools } from "./github-file-tools";
import { githubStatusTools } from "./github-status-tools";

// Re-export all GitHub tools
export const githubTools = {
  ...githubRepoTools,
  ...githubFileTools,
  ...githubStatusTools,
};

// Re-export individual tools for direct imports
export { githubRepoTools } from "./github-repo-tools";
export { githubFileTools } from "./github-file-tools";
export { githubStatusTools } from "./github-status-tools";
