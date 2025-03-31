/**
 * Tool definitions for the AI chat agent
 * Tools can either require human confirmation or execute automatically
 */
import { tool } from "ai";
import { z } from "zod";

import { agentContext } from "./server";
import { uploadWorkerScript } from "./server";
import {
  unstable_getSchedulePrompt,
  unstable_scheduleSchema,
} from "agents/schedule";

/**
 * Weather information tool that requires human confirmation
 * When invoked, this will present a confirmation dialog to the user
 * The actual implementation is in the executions object below
 */
const getWeatherInformation = tool({
  description: "show the weather in a given city to the user",
  parameters: z.object({ city: z.string() }),
  // Omitting execute function makes this tool require human confirmation
});

/**
 * Local time tool that executes automatically
 * Since it includes an execute function, it will run without user confirmation
 * This is suitable for low-risk operations that don't need oversight
 */
const getLocalTime = tool({
  description: "get the local time for a specified location",
  parameters: z.object({ location: z.string() }),
  execute: async ({ location }) => {
    console.log(`Getting local time for ${location}`);
    return "10am";
  },
});

const scheduleTask = tool({
  description: "A tool to schedule a task to be executed at a later time",
  parameters: unstable_scheduleSchema,
  execute: async ({ when, description }) => {
    // we can now read the agent context from the ALS store
    const agent = agentContext.getStore();
    if (!agent) {
      throw new Error("No agent found");
    }
    function throwError(msg: string): string {
      throw new Error(msg);
    }
    if (when.type === "no-schedule") {
      return "Not a valid schedule input";
    }
    const input =
      when.type === "scheduled"
        ? when.date // scheduled
        : when.type === "delayed"
          ? when.delayInSeconds // delayed
          : when.type === "cron"
            ? when.cron // cron
            : throwError("not a valid schedule input");
    try {
      const schedule = await agent.schedule(input!, "executeTask", description);
      return `Task scheduled for type "${when.type}" : ${input} with ID: ${schedule.id}`;
    } catch (error) {
      console.error("error scheduling task", error);
      return `Error scheduling task: ${error}`;
    }
  },
});

/**
 * Tool to remove a previously scheduled task
 */
const removeScheduledTask = tool({
  description: "Remove a previously scheduled task by its ID",
  parameters: z.object({
    id: z.string().describe("The ID of the scheduled task to remove"),
  }),
  execute: async ({ id }) => {
    const agent = agentContext.getStore();
    if (!agent) {
      throw new Error("No agent found");
    }
    
    try {
      const result = await agent.cancelSchedule(id);
      if (result) {
        return `Successfully removed scheduled task with ID: ${id}`;
      } else {
        return `No scheduled task found with ID: ${id}`;
      }
    } catch (error) {
      console.error("Error removing scheduled task:", error);
      return `Error removing scheduled task: ${error}`;
    }
  },
});

/**
 * Tool to list all scheduled tasks
 */
const listScheduledTasks = tool({
  description: "List all scheduled tasks",
  parameters: z.object({}),
  execute: async () => {
    const agent = agentContext.getStore();
    if (!agent) {
      throw new Error("No agent found");
    }
    
    try {
      const schedules = agent.getSchedules();
      
      if (schedules.length === 0) {
        return "No scheduled tasks found.";
      }
      
      const tasksInfo = schedules.map(schedule => {
        let timeInfo = "";
        
        // Handle different schedule types
        if ('type' in schedule) {
          if (schedule.type === 'scheduled' && 'time' in schedule) {
            const date = new Date(schedule.time);
            timeInfo = `scheduled for ${date.toLocaleString()}`;
          } else if (schedule.type === 'cron' && 'cron' in schedule) {
            timeInfo = `recurring with cron pattern: ${schedule.cron}`;
          } else if (schedule.type === 'delayed' && 'delay' in schedule) {
            timeInfo = `delayed by ${schedule.delay} seconds`;
          }
        }
        
        return `- ID: ${schedule.id}, ${timeInfo}, Callback: ${schedule.callback}, Payload: ${schedule.payload}`;
      }).join("\n");
      
      return `Scheduled tasks:\n${tasksInfo}`;
    } catch (error) {
      console.error("Error listing scheduled tasks:", error);
      return `Error listing scheduled tasks: ${error}`;
    }
  },
});

// Define the File schema for the flat file system
const FileSchema = z.object({
  content: z.string().describe("Content of the file"),
  created: z.string().describe("ISO timestamp of file creation"),
  modified: z.string().describe("ISO timestamp of last modification"),
  streaming: z.boolean().optional().describe("Whether the file is currently being streamed")
});

/**
 * Tool to get the file system
 */
const getFileSystem = tool({
  description: "Get the current file system structure from the agent's state",
  parameters: z.object({}),
  execute: async () => {
    try {
      const agent = agentContext.getStore();
      if (!agent) {
        throw new Error("Agent context not found");
      }
      // Access state using agent.state
      const currentState = agent.state || {};
      const agentFileSystem = currentState.files || {};
      console.log("Retrieved file system from agent state:", agentFileSystem);
      return JSON.stringify(agentFileSystem);
    } catch (error) {
      console.error("Error getting file system from agent state:", error);
      return `Error getting file system: ${error}`;
    }
  },
});

/**
 * Tool to set the file system
 */
const setFiles = tool({
  description: "Update the file system structure in the agent's state",
  parameters: z.object({
    files: z.record(z.string(), FileSchema).describe("Object with file paths as keys and file data as values"),
  }),
  execute: async ({ files }) => {
    console.log("setFiles called with:", files);
    try {
      const agent = agentContext.getStore();
      if (!agent) {
        throw new Error("Agent context not found");
      }
      // Update state using agent.setState
      await agent.setState({ files });
      console.log("Agent file system state updated successfully.");
      return "Agent file system state updated successfully";
    } catch (error) {
      console.error("Error setting agent file system state:", error);
      return `Error setting file system: ${error}`;
    }
  },
});

/**
 * Tool to create or update a single file in the file system
 */
const createOrUpdateFile = tool({
  description: "Create a new file or update an existing file in the file system",
  parameters: z.object({
    path: z.string().describe("File path (e.g., 'src/index.ts', 'wrangler.jsonc')"),
    content: z.string().describe("File content"),
    stream: z.boolean().optional().describe("Whether to stream the content (default: false)")
  }),
  execute: async ({ path, content, stream = false }) => {
    try {
      const agent = agentContext.getStore();
      if (!agent) {
        throw new Error("Agent context not found");
      }
      
      const currentState = agent.state || {};
      const files = { ...(currentState.files || {}) };
      const now = new Date().toISOString();
      
      const fileExists = path in files;
      
      if (stream) {
        // Start streaming mode - initialize with empty content
        files[path] = {
          content: "",
          created: fileExists ? files[path].created : now,
          modified: now,
          streaming: true
        };
        
        // Update state to initialize streaming
        await agent.setState({ files });
        
        // Start streaming content in chunks
        const chunkSize = 50; // Characters per chunk
        for (let i = 0; i < content.length; i += chunkSize) {
          const chunk = content.substring(i, i + chunkSize);
          
          // Get latest state to ensure we're appending to the most current content
          const latestState = agent.state || {};
          const latestFiles = { ...(latestState.files || {}) };
          
          if (latestFiles[path]) {
            // Append chunk to existing content
            latestFiles[path] = {
              ...latestFiles[path],
              content: latestFiles[path].content + chunk,
              modified: new Date().toISOString()
            };
            
            // Update state with new chunk
            await agent.setState({ files: latestFiles });
            
            // Small delay to simulate streaming and allow UI to update
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
        
        // Finalize streaming
        const finalState = agent.state || {};
        const finalFiles = { ...(finalState.files || {}) };
        
        if (finalFiles[path]) {
          finalFiles[path] = {
            ...finalFiles[path],
            streaming: false,
            modified: new Date().toISOString()
          };
          
          // Update state to mark streaming as complete
          await agent.setState({ files: finalFiles });
        }
        
        return `File '${path}' has been ${fileExists ? 'updated' : 'created'} with streaming successfully.`;
      } else {
        // Regular non-streaming update
        if (fileExists) {
          // Update existing file (preserve creation date, update modified date)
          files[path] = {
            ...files[path],
            content,
            modified: now,
            streaming: false
          };
        } else {
          // Create new file
          files[path] = {
            content,
            created: now,
            modified: now,
            streaming: false
          };
        }
        
        // Update state
        await agent.setState({ files });
        
        return `File '${path}' has been ${fileExists ? 'updated' : 'created'} successfully.`;
      }
    } catch (error) {
      console.error(`Error creating/updating file '${path}':`, error);
      return `Error creating/updating file: ${error}`;
    }
  }
});

/**
 * Tool to append a chunk to a streaming file
 */
const streamFileChunk = tool({
  description: "Append a chunk of content to a streaming file",
  parameters: z.object({
    path: z.string().describe("File path of the streaming file"),
    chunk: z.string().describe("Content chunk to append"),
    isComplete: z.boolean().optional().describe("Whether this is the final chunk (default: false)")
  }),
  execute: async ({ path, chunk, isComplete = false }) => {
    try {
      const agent = agentContext.getStore();
      if (!agent) {
        throw new Error("Agent context not found");
      }
      
      const currentState = agent.state || {};
      const files = { ...(currentState.files || {}) };
      
      // Check if file exists and is in streaming mode
      if (!files[path]) {
        return `Error: File '${path}' does not exist.`;
      }
      
      // Append chunk to existing content
      files[path] = {
        ...files[path],
        content: files[path].content + chunk,
        modified: new Date().toISOString(),
        streaming: !isComplete
      };
      
      // Update state
      await agent.setState({ files });
      
      return isComplete 
        ? `File '${path}' streaming completed successfully.` 
        : `Chunk appended to '${path}' successfully.`;
    } catch (error) {
      console.error(`Error streaming chunk to file '${path}':`, error);
      return `Error streaming chunk: ${error}`;
    }
  }
});

/**
 * Tool to delete a file from the file system
 */
const deleteFile = tool({
  description: "Delete a file from the file system",
  parameters: z.object({
    path: z.string().describe("Path of the file to delete"),
  }),
  execute: async ({ path }) => {
    try {
      const agent = agentContext.getStore();
      if (!agent) {
        throw new Error("Agent context not found");
      }
      
      const currentState = agent.state || {};
      const files = { ...(currentState.files || {}) };
      
      // Check if file exists
      if (!files[path]) {
        return `File '${path}' does not exist.`;
      }
      
      // Delete file
      delete files[path];
      
      // Update state
      await agent.setState({ files });
      
      return `File '${path}' has been deleted successfully.`;
    } catch (error) {
      console.error(`Error deleting file '${path}':`, error);
      return `Error deleting file: ${error}`;
    }
  }
});

/**
 * Export all available tools
 * These will be provided to the AI model to describe available capabilities
 */
export const tools = {
  getWeatherInformation,
  getLocalTime,
  scheduleTask,
  removeScheduledTask,
  listScheduledTasks,
  getFileSystem,
  setFiles,
  createOrUpdateFile,
  streamFileChunk,
  deleteFile,
};

/**
 * Implementation of confirmation-required tools
 * This object contains the actual logic for tools that need human approval
 * Each function here corresponds to a tool above that doesn't have an execute function
 */
export const executions = {
  getWeatherInformation: async ({ city }: { city: string }) => {
    console.log(`Getting weather information for ${city}`);
    return `The weather in ${city} is sunny`;
  },
};
