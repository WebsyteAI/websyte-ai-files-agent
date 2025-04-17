/**
 * GitHub repository tools for the AI chat agent
 * Handles GitHub repository creation and management
 */
import { tool } from "ai";
import { z } from "zod";
import { agentContext } from "../agent";
import { GitHubModule } from "../agents/GitHubModule";

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
    const agent = agentContext.getStore();
    if (!agent) throw new Error("Agent context not found");
    const github = new GitHubModule(agent.state);
    return await github.createRepository({ description, private: isPrivate, autoInit });
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
    const agent = agentContext.getStore();
    if (!agent) throw new Error("Agent context not found");
    const github = new GitHubModule(agent.state);
    return await github.checkRepository();
  },
});

// Export all GitHub repository tools
export const githubRepoTools = {
  createGitHubRepository,
  checkGitHubRepository,
};
