/**
 * Router module for handling API requests using Hono
 * Provides a structured way to define routes and middleware
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { tools } from "./tools";
import { agentContext } from "./agent";
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
    
    // Placeholder response - not actually executing any tools
    console.log(`Tool execution request received: ${toolName}`, params);
    
    // Return a placeholder success response
    const placeholderResponse: ToolExecutionResponse = {
      success: true,
      content: {
        message: `Tool '${toolName}' execution placeholder`,
        receivedParams: params
      }
    };
    
    return c.json(placeholderResponse, 200);
  } catch (error) {
    console.error('Error in tool execution endpoint:', error);
    const errorResponse: ToolExecutionResponse = {
      success: false,
      message: 'Error processing tool request'
    };
    
    return c.json(errorResponse, 400);
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
