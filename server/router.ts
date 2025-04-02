/**
 * Router module for handling API requests using Hono
 * Provides a structured way to define routes and middleware
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { tools } from "./tools";
import { agentContext } from "./server";
import type { ToolExecutionResponse } from "./types";

// Create a Hono router for API endpoints
const router = new Hono<{ Bindings: Env }>();

// Add CORS middleware
router.use('*', cors());

/**
 * Tool execution endpoint
 * Executes a specified tool with the provided parameters
 */
router.post('/api/agent/tool', async (c) => {
  try {
    const data = await c.req.json();
    const { tool: toolName, params } = data;
    
    if (!toolName) {
      const errorResponse: ToolExecutionResponse = {
        success: false,
        message: 'Tool name is required'
      };
      
      return c.json(errorResponse, 400);
    }
    
    // Check if the tool exists
    if (!tools[toolName as keyof typeof tools]) {
      const errorResponse: ToolExecutionResponse = {
        success: false,
        message: `Tool '${toolName}' not found`
      };
      
      return c.json(errorResponse, 400);
    }
    
    // Get the agent instance
    const url = new URL(c.req.url);
    const agentId = url.searchParams.get('agentId') || 'default';
    const agentNamespace = c.env.Chat;
    const agentIdObj = agentNamespace.idFromName(agentId);
    const agent = agentNamespace.get(agentIdObj);
    
    // Execute the tool within the agent context
    const response = await agentContext.run(agent, async () => {
      try {
        // Execute the tool
        const tool = tools[toolName as keyof typeof tools];
        // @ts-ignore
        const result = await tool.execute(params);
        
        const response: ToolExecutionResponse = {
          success: true,
          content: result
        };
        
        return response;
      } catch (error) {
        console.error(`Error executing tool '${toolName}':`, error);
        const errorResponse: ToolExecutionResponse = {
          success: false,
          message: error instanceof Error ? error.message : String(error)
        };
        
        return errorResponse;
      }
    });
    
    return c.json(response, response.success ? 200 : 500);
  } catch (error) {
    console.error('Error in tool execution endpoint:', error);
    const errorResponse: ToolExecutionResponse = {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
    
    return c.json(errorResponse, 500);
  }
});

// Add a health check endpoint
router.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Export the router for use in the main server file
export { router };
