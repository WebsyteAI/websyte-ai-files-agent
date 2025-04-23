/**
 * AI tools for the chat agent
 * Handles AI-powered operations and demonstrations
 */
import { tool } from "ai";
import { z } from "zod";

/**
 * Weather information tool that requires human confirmation
 * When invoked, this will present a confirmation dialog to the user
 * The actual implementation is in the executions object below
 */
export const getWeatherInformation = tool({
  description: "show the weather in a given city to the user",
  parameters: z.object({ city: z.string() }),
  // Omitting execute function makes this tool require human confirmation
});

/**
 * Local time tool that executes automatically
 * Since it includes an execute function, it will run without user confirmation
 * This is suitable for low-risk operations that don't need oversight
 */
export const getLocalTime = tool({
  description: "get the local time for a specified location",
  parameters: z.object({ location: z.string() }),
  execute: async ({ location }) => {
    console.log(`Getting local time for ${location}`);
    return "10am";
  },
});

/**
 * Split an agent prompt into smaller, actionable tasks
 * This tool analyzes a high-level agent description and breaks it down
 * into specific components and functionality
 */
export const splitAgentPrompt = tool({
  description: "split a high-level agent description into smaller, actionable tasks",
  parameters: z.object({ 
    prompt: z.string().describe("The high-level description of the AI agent to be built")
  }),
  execute: async ({ prompt }) => {
    console.log(`Splitting agent prompt: ${prompt}`);
    
    // In a real implementation, this would call an LLM to analyze the prompt
    // For now, we'll return a sample response with predefined tasks
    
    // Sample tasks for an AI agent
    const tasks = [
      {
        title: "Define Agent Core Functionality",
        description: "Implement the main agent class with core methods for handling requests and maintaining state.",
        category: "core"
      },
      {
        title: "Implement State Management",
        description: "Create state persistence and retrieval mechanisms for the agent to maintain context across sessions.",
        category: "state"
      },
      {
        title: "Add Tool Integration Framework",
        description: "Build a system for the agent to discover, access, and use external tools and APIs.",
        category: "tools"
      },
      {
        title: "Create API Endpoints",
        description: "Implement RESTful endpoints for interacting with the agent from external applications.",
        category: "api"
      },
      {
        title: "Develop Testing Framework",
        description: "Create a comprehensive testing suite to validate agent behavior and responses.",
        category: "testing"
      },
      {
        title: "Implement Error Handling",
        description: "Add robust error handling and recovery mechanisms to ensure agent reliability.",
        category: "core"
      },
      {
        title: "Add Authentication System",
        description: "Implement secure authentication for agent access and operations.",
        category: "api"
      },
      {
        title: "Create Logging System",
        description: "Develop a logging system to track agent activities and aid in debugging.",
        category: "tools"
      }
    ];
    
    return { tasks };
  },
});

// Export all AI tools
export const aiTools = {
  getWeatherInformation,
  getLocalTime,
  splitAgentPrompt,
};

// Implementation of confirmation-required tools
// This object contains the actual logic for tools that need human approval
export const aiExecutions = {
  getWeatherInformation: async ({ city }: { city: string }) => {
    console.log(`Getting weather information for ${city}`);
    return `The weather in ${city} is sunny`;
  },
};
