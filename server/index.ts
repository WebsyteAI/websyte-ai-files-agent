import { routeAgentRequest } from "agents";
import type { ExecutionContext } from "@cloudflare/workers-types";
// Import the agent classes and contexts from the agent file
import { Chat, agentContext, TestMcpAgent } from "./agent";
// Import the router
import { router } from './router';

// Note: The agent classes and contexts are now defined in agent.ts
export { Chat, agentContext, TestMcpAgent };

/**
 * Worker entry point that routes incoming requests to the appropriate handler
 */
// Define the worker handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (!env.OPENAI_API_KEY) {
      console.error(
        "OPENAI_API_KEY is not set, don't forget to set it locally in .dev.vars, and use `wrangler secret bulk .dev.vars` to upload it to production"
      );
      return new Response("OPENAI_API_KEY is not set", { status: 500 });
    }

    // Try to handle the request with Hono
    const url = new URL(request.url);
    
    // If the request is for an API endpoint, use the Hono router
    if (url.pathname.startsWith('/api/')) {
      return router.fetch(request as any, env, ctx);
    }
    
    // Route to an agent using the standard Agents routing mechanism
    // This will automatically handle routes like /agents/test-mcp-agent/:name
    const agentResponse = await routeAgentRequest(request as any, env, { cors: true });
    if (agentResponse) {
      return agentResponse;
    }
    
    return new Response("Not found", { status: 404 });
  },
};
