import { routeAgentRequest } from "agents";
import type { ExecutionContext } from "@cloudflare/workers-types";
// Import the agent class and context from the new file
import { Chat, agentContext } from "./agent";
// Import the router
import { router } from './router';

// Note: The Chat class and agentContext are now defined in agent.ts
export {Chat, agentContext};

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
    
    // Otherwise, try to route to an agent
    const agentResponse = await routeAgentRequest(request as any, env);
    if (agentResponse) {
      return agentResponse;
    }
    
    return new Response("Not found", { status: 404 });
  },
};
