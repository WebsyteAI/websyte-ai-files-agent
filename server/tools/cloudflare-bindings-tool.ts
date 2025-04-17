import { tool } from "ai";
import { z } from "zod";
import { agentContext } from "../agent";

/**
 * Tool to check the bindings of a Cloudflare Worker deployed via Workers for Platforms Dispatch.
 * Calls the Cloudflare API to fetch the list of bindings for a given worker script.
 */
export const getCloudflareWorkerBindings = tool({
  description:
    "Fetches the bindings of a Cloudflare Worker deployed via Workers for Platforms Dispatch. Uses agent state for account ID, dispatch namespace, and script name. Requires CLOUDFLARE_API_TOKEN in environment.",
  parameters: z.object({}),
  execute: async () => {
    try {
      const agent = agentContext.getStore();
      if (!agent) {
        throw new Error("Agent context not found");
      }

      // Get values from agent state
      const currentState = agent.state || {};
      const namespace = currentState.dispatchNamespace;
      const worker = currentState.agentName;
      const accountIdToUse = currentState.dispatchNamespaceAccountId;

      // Validate required parameters
      if (!namespace) {
        throw new Error("Dispatch namespace is required in agent state");
      }
      if (!worker) {
        throw new Error("Worker script name is required in agent state");
      }
      if (!accountIdToUse) {
        throw new Error("Account ID is required in agent state");
      }

      // Get API token from environment
      const authToken = process.env.CLOUDFLARE_API_TOKEN;
      if (!authToken) {
        return {
          success: false,
          message:
            "CLOUDFLARE_API_TOKEN environment variable not set. Please ensure it is configured in your environment.",
        };
      }

      // Setup headers for Cloudflare API requests
      const headers = {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      };

      // Base URL for Cloudflare API
      const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${accountIdToUse}/workers/dispatch/namespaces/${namespace}/scripts/${worker}/bindings`;

      const response = await fetch(apiUrl, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          message: `Failed to fetch bindings: ${response.status}. Details: ${errorText}`,
        };
      }

      const data = await response.json();

      return {
        success: true,
        message: `Successfully retrieved ${data.result.length} bindings for worker ${worker}`,
        bindings: data.result,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error fetching worker bindings: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  },
});
