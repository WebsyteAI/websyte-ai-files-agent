/**
 * Router module for handling API requests
 * Separates routing logic from the main server file
 */
import { tools } from "./tools";
import { agentContext } from "./server";
import type { ExecutionContext } from "@cloudflare/workers-types";
import type { ToolExecutionResponse } from "./types";

/**
 * Handles API requests to the agent
 * @param request The incoming request
 * @param env Environment variables and bindings
 * @param ctx Execution context
 * @returns Response or null if the request wasn't handled
 */
export async function handleApiRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response | null> {
  const url = new URL(request.url);
  
  // Handle tool execution API endpoint
  if (url.pathname === '/api/agent/tool' && request.method === 'POST') {
    return handleToolExecution(request, env);
  }
  
  // Add more API endpoints here as needed
  
  // Return null if no endpoint matched
  return null;
}

/**
 * Handles tool execution requests
 * @param request The incoming request
 * @param env Environment variables and bindings
 * @returns Response with the tool execution result
 */
async function handleToolExecution(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const data = await request.json();
    const { tool: toolName, params } = data;
    
    if (!toolName) {
      const errorResponse: ToolExecutionResponse = {
        success: false,
        message: 'Tool name is required'
      };
      
      return new Response(
        JSON.stringify(errorResponse),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Check if the tool exists
    if (!tools[toolName as keyof typeof tools]) {
      const errorResponse: ToolExecutionResponse = {
        success: false,
        message: `Tool '${toolName}' not found`
      };
      
      return new Response(
        JSON.stringify(errorResponse),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Get the agent instance
    const url = new URL(request.url);
    const agentId = url.searchParams.get('agentId') || 'default';
    const agentNamespace = env.Chat;
    const agentIdObj = agentNamespace.idFromName(agentId);
    const agent = agentNamespace.get(agentIdObj);
    
    // Execute the tool within the agent context
    return await agentContext.run(agent, async () => {
      try {
        // Execute the tool
        const tool = tools[toolName as keyof typeof tools];
        // @ts-ignore
        const result = await tool.execute(params);
        
        const response: ToolExecutionResponse = {
          success: true,
          content: result
        };
        
        return new Response(
          JSON.stringify(response),
          { headers: { 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        console.error(`Error executing tool '${toolName}':`, error);
        const errorResponse: ToolExecutionResponse = {
          success: false,
          message: error instanceof Error ? error.message : String(error)
        };
        
        return new Response(
          JSON.stringify(errorResponse),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    });
  } catch (error) {
    console.error('Error in tool execution endpoint:', error);
    const errorResponse: ToolExecutionResponse = {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
    
    return new Response(
      JSON.stringify(errorResponse),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
