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
  parameters: z.object({
    accountId: z.string().describe("Cloudflare account ID"),
    dispatchNamespace: z.string().optional().describe("Workers for Platforms namespace (optional if stored in agent state)"),
    scriptName: z.string().optional().describe("Worker script name (optional if stored in agent state)"),
  }),
  execute: async ({ accountId, dispatchNamespace, scriptName }) => {
    try {
      const agent = agentContext.getStore();
      if (!agent) {
        throw new Error("Agent context not found");
      }

      // Get values from environment variables or agent state if not provided
      const currentState = agent.state || {};
      const namespace = dispatchNamespace || currentState.dispatchNamespace || process.env.DISPATCH_NAMESPACE_NAME;
      const worker = scriptName || currentState.agentName;
      const accountIdToUse = accountId || process.env.DISPATCH_NAMESPACE_ACCOUNT_ID;

      // Validate required parameters
      if (!namespace) {
        return {
          success: false,
          message: "Dispatch namespace is required. Either provide it as a parameter or set it in agent state first."
        };
      }

      if (!worker) {
        return {
          success: false,
          message: "Worker script name is required. Either provide it as a parameter or set it in agent state first."
        };
      }

      // Get API token from environment
      const authToken = process.env.CLOUDFLARE_API_KEY;
      if (!authToken) {
        return {
          success: false,
          message: "CLOUDFLARE_API_KEY environment variable not set. Please ensure it is configured in your environment."
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
      
      // Update agent state with namespace, account ID, and script name if they were provided
      if (dispatchNamespace || scriptName || accountId) {
        const stateUpdates: Record<string, any> = {};
        
        if (dispatchNamespace && dispatchNamespace !== currentState.dispatchNamespace) {
          stateUpdates.dispatchNamespace = dispatchNamespace;
        }
        
        if (accountId && accountId !== currentState.dispatchNamespaceAccountId) {
          stateUpdates.dispatchNamespaceAccountId = accountId;
        }
        
        if (scriptName && scriptName !== currentState.agentName) {
          stateUpdates.agentName = scriptName;
        }
        
        if (Object.keys(stateUpdates).length > 0) {
          await agent.setState({
            ...currentState,
            ...stateUpdates,
          });
          console.log("Updated agent state with worker configuration");
        }
      }
      
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
    accountId: z.string().describe("Cloudflare account ID"),
    dispatchNamespace: z.string().optional().describe("Workers for Platforms namespace (optional if stored in agent state)"),
    scriptName: z.string().optional().describe("Worker script name (optional if stored in agent state)"),
    secretName: z.string().describe("Name of the secret to add"),
    secretValue: z.string().describe("Value of the secret"),
  }),
  execute: async ({ accountId, dispatchNamespace, scriptName, secretName, secretValue }) => {
    try {
      const agent = agentContext.getStore();
      if (!agent) {
        throw new Error("Agent context not found");
      }

      // Get values from environment variables or agent state if not provided
      const currentState = agent.state || {};
      const namespace = dispatchNamespace || currentState.dispatchNamespace || process.env.DISPATCH_NAMESPACE_NAME;
      const worker = scriptName || currentState.agentName;
      const accountIdToUse = accountId || process.env.DISPATCH_NAMESPACE_ACCOUNT_ID;

      // Validate required parameters
      if (!namespace) {
        return {
          success: false,
          message: "Dispatch namespace is required. Either provide it as a parameter or set it in agent state first."
        };
      }

      if (!worker) {
        return {
          success: false,
          message: "Worker script name is required. Either provide it as a parameter or set it in agent state first."
        };
      }

      // Get API token from environment
      const authToken = process.env.CLOUDFLARE_API_KEY;
      if (!authToken) {
        return {
          success: false,
          message: "CLOUDFLARE_API_KEY environment variable not set. Please ensure it is configured in your environment."
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
      
      // Update agent state with namespace, account ID, and script name if they were provided
      if (dispatchNamespace || scriptName || accountId) {
        const stateUpdates: Record<string, any> = {};
        
        if (dispatchNamespace && dispatchNamespace !== currentState.dispatchNamespace) {
          stateUpdates.dispatchNamespace = dispatchNamespace;
        }
        
        if (accountId && accountId !== currentState.dispatchNamespaceAccountId) {
          stateUpdates.dispatchNamespaceAccountId = accountId;
        }
        
        if (scriptName && scriptName !== currentState.agentName) {
          stateUpdates.agentName = scriptName;
        }
        
        if (Object.keys(stateUpdates).length > 0) {
          await agent.setState({
            ...currentState,
            ...stateUpdates,
          });
          console.log("Updated agent state with worker configuration");
        }
      }
      
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
    accountId: z.string().describe("Cloudflare account ID"),
    dispatchNamespace: z.string().optional().describe("Workers for Platforms namespace (optional if stored in agent state)"),
    scriptName: z.string().optional().describe("Worker script name (optional if stored in agent state)"),
    secretName: z.string().describe("Name of the secret to get"),
  }),
  execute: async ({ accountId, dispatchNamespace, scriptName, secretName }) => {
    try {
      const agent = agentContext.getStore();
      if (!agent) {
        throw new Error("Agent context not found");
      }

      // Get values from environment variables or agent state if not provided
      const currentState = agent.state || {};
      const namespace = dispatchNamespace || currentState.dispatchNamespace || process.env.DISPATCH_NAMESPACE_NAME;
      const worker = scriptName || currentState.agentName;
      const accountIdToUse = accountId || process.env.DISPATCH_NAMESPACE_ACCOUNT_ID;

      // Validate required parameters
      if (!namespace) {
        return {
          success: false,
          message: "Dispatch namespace is required. Either provide it as a parameter or set it in agent state first."
        };
      }

      if (!worker) {
        return {
          success: false,
          message: "Worker script name is required. Either provide it as a parameter or set it in agent state first."
        };
      }

      // Get API token from environment
      const authToken = process.env.CLOUDFLARE_API_KEY;
      if (!authToken) {
        return {
          success: false,
          message: "CLOUDFLARE_API_KEY environment variable not set. Please ensure it is configured in your environment."
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
      
      // Update agent state with namespace, account ID, and script name if they were provided
      if (dispatchNamespace || scriptName || accountId) {
        const stateUpdates: Record<string, any> = {};
        
        if (dispatchNamespace && dispatchNamespace !== currentState.dispatchNamespace) {
          stateUpdates.dispatchNamespace = dispatchNamespace;
        }
        
        if (accountId && accountId !== currentState.dispatchNamespaceAccountId) {
          stateUpdates.dispatchNamespaceAccountId = accountId;
        }
        
        if (scriptName && scriptName !== currentState.agentName) {
          stateUpdates.agentName = scriptName;
        }
        
        if (Object.keys(stateUpdates).length > 0) {
          await agent.setState({
            ...currentState,
            ...stateUpdates,
          });
          console.log("Updated agent state with worker configuration");
        }
      }
      
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
    accountId: z.string().describe("Cloudflare account ID"),
    dispatchNamespace: z.string().optional().describe("Workers for Platforms namespace (optional if stored in agent state)"),
    scriptName: z.string().optional().describe("Worker script name (optional if stored in agent state)"),
    secretName: z.string().describe("Name of the secret to delete"),
  }),
  execute: async ({ accountId, dispatchNamespace, scriptName, secretName }) => {
    try {
      const agent = agentContext.getStore();
      if (!agent) {
        throw new Error("Agent context not found");
      }

      // Get values from environment variables or agent state if not provided
      const currentState = agent.state || {};
      const namespace = dispatchNamespace || currentState.dispatchNamespace || process.env.DISPATCH_NAMESPACE_NAME;
      const worker = scriptName || currentState.agentName;
      const accountIdToUse = accountId || process.env.DISPATCH_NAMESPACE_ACCOUNT_ID;

      // Validate required parameters
      if (!namespace) {
        return {
          success: false,
          message: "Dispatch namespace is required. Either provide it as a parameter or set it in agent state first."
        };
      }

      if (!worker) {
        return {
          success: false,
          message: "Worker script name is required. Either provide it as a parameter or set it in agent state first."
        };
      }

      // Get API token from environment
      const authToken = process.env.CLOUDFLARE_API_KEY;
      if (!authToken) {
        return {
          success: false,
          message: "CLOUDFLARE_API_KEY environment variable not set. Please ensure it is configured in your environment."
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
      
      // Update agent state with namespace, account ID, and script name if they were provided
      if (dispatchNamespace || scriptName || accountId) {
        const stateUpdates: Record<string, any> = {};
        
        if (dispatchNamespace && dispatchNamespace !== currentState.dispatchNamespace) {
          stateUpdates.dispatchNamespace = dispatchNamespace;
        }
        
        if (accountId && accountId !== currentState.dispatchNamespaceAccountId) {
          stateUpdates.dispatchNamespaceAccountId = accountId;
        }
        
        if (scriptName && scriptName !== currentState.agentName) {
          stateUpdates.agentName = scriptName;
        }
        
        if (Object.keys(stateUpdates).length > 0) {
          await agent.setState({
            ...currentState,
            ...stateUpdates,
          });
          console.log("Updated agent state with worker configuration");
        }
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

/**
 * Tool to set the worker configuration in the agent state
 */
export const setWorkerConfig = tool({
  description: "Set the Cloudflare Worker configuration in the agent state",
  parameters: z.object({
    dispatchNamespace: z.string().describe("Workers for Platforms namespace"),
    dispatchNamespaceAccountId: z.string().describe("Cloudflare account ID for the dispatch namespace"),
    scriptName: z.string().describe("Worker script name"),
  }),
  execute: async ({ dispatchNamespace, dispatchNamespaceAccountId, scriptName }) => {
    try {
      const agent = agentContext.getStore();
      if (!agent) {
        throw new Error("Agent context not found");
      }

      const currentState = agent.state || {};
      
      // Update agent state with the worker configuration
      await agent.setState({
        ...currentState,
        dispatchNamespace,
        dispatchNamespaceAccountId,
        agentName: scriptName,
      });
      
      return {
        success: true,
        message: `Successfully set worker configuration in agent state: namespace=${dispatchNamespace}, script=${scriptName}`,
      };
    } catch (error) {
      console.error("Error setting worker configuration:", error);
      return {
        success: false,
        message: `Error setting worker configuration: ${error instanceof Error ? error.message : String(error)}`
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
  setWorkerConfig,
};
