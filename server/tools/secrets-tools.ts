/**
 * Cloudflare Worker Secrets tools for the AI chat agent
 * Handles secret management for Cloudflare Workers
 */
import { tool } from "ai";
import { z } from "zod";
import { agentContext } from "../agent";

/**
 * Tool to list all secrets for a worker script
 */
export const listWorkerSecrets = tool({
  description: "List all secrets bound to a Cloudflare Worker script",
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

      console.log("Current agent state:", accountIdToUse, namespace, worker);

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
          message: "CLOUDFLARE_API_TOKEN environment variable not set. Please ensure it is configured in your environment."
        };
      }

      // Setup headers for Cloudflare API requests
      const headers = {
        "Authorization": `Bearer ${authToken}`,
        "Content-Type": "application/json",
      };

      // Base URL for Cloudflare API
      const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${accountIdToUse}/workers/dispatch/namespaces/${namespace}/scripts/${worker}/secrets`;
      
      console.log(`Listing secrets for worker ${worker} in namespace ${namespace}`);
      
      const response = await fetch(apiUrl, {
        method: "GET",
        headers,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Cloudflare API error (${response.status}): ${errorText}`);
        return {
          success: false,
          message: `Failed to list secrets: ${response.status}. Details: ${errorText}`
        };
      }
      
      const data = await response.json();
      
      
      return {
        success: true,
        message: `Successfully retrieved ${data.result.length} secrets for worker ${worker}`,
        secrets: data.result,
      };
    } catch (error) {
      console.error("Error listing worker secrets:", error);
      return {
        success: false,
        message: `Error listing worker secrets: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  },
});

/**
 * Tool to add a secret to a worker script
 */
export const addWorkerSecret = tool({
  description: "Add a secret to a Cloudflare Worker script",
  parameters: z.object({
    secretName: z.string().describe("Name of the secret to add"),
    secretValue: z.string().describe("Value of the secret"),
  }),
  execute: async ({ secretName, secretValue }) => {
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
          message: "CLOUDFLARE_API_TOKEN environment variable not set. Please ensure it is configured in your environment."
        };
      }

      // Setup headers for Cloudflare API requests
      const headers = {
        "Authorization": `Bearer ${authToken}`,
        "Content-Type": "application/json",
      };

      // Base URL for Cloudflare API
      const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${accountIdToUse}/workers/dispatch/namespaces/${namespace}/scripts/${worker}/secrets`;
      
      console.log(`Adding secret ${secretName} to worker ${worker} in namespace ${namespace}`);
      
      const response = await fetch(apiUrl, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          name: secretName,
          text: secretValue,
          type: "secret_text"
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Cloudflare API error (${response.status}): ${errorText}`);
        return {
          success: false,
          message: `Failed to add secret: ${response.status}. Details: ${errorText}`
        };
      }
      
      const data = await response.json();
      
      
      return {
        success: true,
        message: `Successfully added secret ${secretName} to worker ${worker}`,
        result: data.result,
      };
    } catch (error) {
      console.error("Error adding worker secret:", error);
      return {
        success: false,
        message: `Error adding worker secret: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  },
});

/**
 * Tool to get a specific secret binding from a worker script
 */
export const getWorkerSecret = tool({
  description: "Get a specific secret binding from a Cloudflare Worker script",
  parameters: z.object({
    secretName: z.string().describe("Name of the secret to get"),
  }),
  execute: async ({ secretName }) => {
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
          message: "CLOUDFLARE_API_TOKEN environment variable not set. Please ensure it is configured in your environment."
        };
      }

      // Setup headers for Cloudflare API requests
      const headers = {
        "Authorization": `Bearer ${authToken}`,
        "Content-Type": "application/json",
      };

      // Base URL for Cloudflare API
      const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${accountIdToUse}/workers/dispatch/namespaces/${namespace}/scripts/${worker}/secrets/${secretName}`;
      
      console.log(`Getting secret ${secretName} from worker ${worker} in namespace ${namespace}`);
      
      const response = await fetch(apiUrl, {
        method: "GET",
        headers,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Cloudflare API error (${response.status}): ${errorText}`);
        return {
          success: false,
          message: `Failed to get secret: ${response.status}. Details: ${errorText}`
        };
      }
      
      const data = await response.json();
      
      
      return {
        success: true,
        message: `Successfully retrieved secret ${secretName} from worker ${worker}`,
        secret: data.result,
      };
    } catch (error) {
      console.error("Error getting worker secret:", error);
      return {
        success: false,
        message: `Error getting worker secret: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  },
});

/**
 * Tool to delete a secret from a worker script
 */
export const deleteWorkerSecret = tool({
  description: "Delete a secret from a Cloudflare Worker script",
  parameters: z.object({
    secretName: z.string().describe("Name of the secret to delete"),
  }),
  execute: async ({ secretName }) => {
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
          message: "CLOUDFLARE_API_TOKEN environment variable not set. Please ensure it is configured in your environment."
        };
      }

      // Setup headers for Cloudflare API requests
      const headers = {
        "Authorization": `Bearer ${authToken}`,
        "Content-Type": "application/json",
      };

      // Base URL for Cloudflare API
      const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${accountIdToUse}/workers/dispatch/namespaces/${namespace}/scripts/${worker}/secrets/${secretName}`;
      
      console.log(`Deleting secret ${secretName} from worker ${worker} in namespace ${namespace}`);
      
      const response = await fetch(apiUrl, {
        method: "DELETE",
        headers,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Cloudflare API error (${response.status}): ${errorText}`);
        return {
          success: false,
          message: `Failed to delete secret: ${response.status}. Details: ${errorText}`
        };
      }
      
      
      return {
        success: true,
        message: `Successfully deleted secret ${secretName} from worker ${worker}`,
      };
    } catch (error) {
      console.error("Error deleting worker secret:", error);
      return {
        success: false,
        message: `Error deleting worker secret: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  },
});

// Export all secrets tools
export const secretsTools = {
  listWorkerSecrets,
  addWorkerSecret,
  getWorkerSecret,
  deleteWorkerSecret,
};
