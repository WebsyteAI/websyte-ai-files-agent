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

// Export all AI tools
export const aiTools = {
  getWeatherInformation,
  getLocalTime,
};

// Implementation of confirmation-required tools
// This object contains the actual logic for tools that need human approval
export const aiExecutions = {
  getWeatherInformation: async ({ city }: { city: string }) => {
    console.log(`Getting weather information for ${city}`);
    return `The weather in ${city} is sunny`;
  },
};
