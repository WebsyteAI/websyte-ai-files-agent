/**
 * Central export point for all tools used by the AI chat agent
 * This file aggregates tools from domain-specific modules
 */
import { aiTools, aiExecutions } from "./ai-tools";
import { filesystemTools } from "./filesystem-tools";
import { githubTools } from "./github-tools";
import { scheduleTools } from "./schedule-tools";
import { secretsTools } from "./secrets-tools";
import { testEndpoint } from "./network-tools"; // Import network tools

// Combine all tools into a single object
export const tools = {
  ...aiTools,
  ...filesystemTools,
  ...githubTools,
  testEndpoint, // Add network tool correctly
  ...scheduleTools,
  ...secretsTools,
};

// Combine all executions into a single object
export const executions = {
  ...aiExecutions,
};

// Export individual tool groups for more granular imports if needed
export { aiTools, aiExecutions } from "./ai-tools";
export { filesystemTools } from "./filesystem-tools";
export { githubTools } from "./github-tools";
export { scheduleTools } from "./schedule-tools";
export { secretsTools } from "./secrets-tools";
export { testEndpoint } from "./network-tools"; // Export network tool correctly
