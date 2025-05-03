/**
 * Filesystem tools for the AI chat agent
 * Handles file operations within the agent's state
 *
 * This module contains both utility functions for file operations
 * and the tools that expose these operations to the AI
 */
import { tool } from "ai";
import { z } from "zod";
import { agentContext } from "../agent";
import type { FileRecord, AgentState } from "../types";

// Define the File schema for the flat file system
export const FileSchema = z.object({
  content: z.string().describe("Content of the file"),
  created: z.string().describe("ISO timestamp of file creation"),
  modified: z.string().describe("ISO timestamp of last modification"),
  streaming: z
    .boolean()
    .optional()
    .describe("Whether the file is currently being streamed"),
});

/**
 * Utility functions for file operations
 * These were previously in FilesystemModule class
 */

/**
 * Create or update a file in the agent state
 * Returns "created" or "updated" based on the operation performed
 */
export function createOrUpdateFileInState(state: AgentState, path: string, content: string): "created" | "updated" {
  // Ensure files object exists
  const files = { ...(state.files || {}) };
  const now = new Date().toISOString();
  const fileExists = path in files;
  
  if (fileExists) {
    files[path] = {
      ...files[path],
      content,
      modified: now,
    };
  } else {
    files[path] = {
      content,
      created: now,
      modified: now,
    };
  }
  
  // Update state
  state.files = files;
  return fileExists ? "updated" : "created";
}

/**
 * Delete a file from the agent state
 * Returns true if the file was deleted, false if it didn't exist
 */
export function deleteFileFromState(state: AgentState, path: string): boolean {
  const files = { ...(state.files || {}) };
  if (!files[path]) {
    return false;
  }
  
  delete files[path];
  state.files = files;
  return true;
}

/**
 * Tool to get the file system
 */
export const getFileSystem = tool({
  description: "Get the current file system structure from the agent's state",
  parameters: z.object({}),
  execute: async () => {
    try {
      const agent = agentContext.getStore();
      if (!agent) throw new Error("Agent context not found");
      // Always return files from the agent store directly
      return JSON.stringify(agent.state.files || {});
    } catch (error) {
      console.error("Error getting file system from agent state:", error);
      return `Error getting file system: ${error}`;
    }
  },
});

/**
 * Tool to set the file system
 */
export const setFiles = tool({
  description: "Update the file system structure in the agent's state",
  parameters: z.object({
    files: z
      .record(z.string(), FileSchema)
      .describe("Object with file paths as keys and file data as values"),
  }),
  execute: async ({ files }) => {
    try {
      const agent = agentContext.getStore();
      if (!agent) throw new Error("Agent context not found");
      
      // Update agent state directly
      await agent.setState({
        ...agent.state,
        files,
      });
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
export const createOrUpdateFile = tool({
  description:
    "Create a new file or update an existing file in the file system",
  parameters: z.object({
    path: z
      .string()
      .describe("File path (e.g., 'src/index.ts', 'wrangler.jsonc')"),
    content: z.string().describe("File content"),
  }),
  execute: async ({ path, content }) => {
    try {
      const agent = agentContext.getStore();
      if (!agent) throw new Error("Agent context not found");
      
      // Create or update the file and get the operation result
      const op = createOrUpdateFileInState(agent.state, path, content);
      
      // Update the agent state with the modified files
      await agent.setState({
        ...agent.state,
        files: agent.state.files,
      });
      
      return `File '${path}' has been ${op} successfully.`;
    } catch (error) {
      console.error(`Error creating/updating file '${path}':`, error);
      return `Error creating/updating file: ${error}`;
    }
  },
});

/**
 * Tool to delete a file from the file system
 */
export const deleteFile = tool({
  description: "Delete a file from the file system",
  parameters: z.object({
    path: z.string().describe("Path of the file to delete"),
  }),
  execute: async ({ path }) => {
    try {
      const agent = agentContext.getStore();
      if (!agent) throw new Error("Agent context not found");
      
      // Delete the file and get the result
      const deleted = deleteFileFromState(agent.state, path);
      
      // Update the agent state with the modified files
      await agent.setState({
        ...agent.state,
        files: agent.state.files,
      });
      
      // Return appropriate message based on the result
      return deleted
        ? `File '${path}' has been deleted successfully.`
        : `File '${path}' does not exist.`;
    } catch (error) {
      console.error(`Error deleting file '${path}':`, error);
      return `Error deleting file: ${error}`;
    }
  },
});

// Export all filesystem tools
export const filesystemTools = {
  getFileSystem,
  setFiles,
  createOrUpdateFile,
  deleteFile,
};
