/**
 * Filesystem tools for the AI chat agent
 * Handles file operations within the agent's state
 */
import { tool } from "ai";
import { z } from "zod";
import { agentContext } from "../agent";
import type { FileRecord } from "../types";

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

import { FilesystemModule } from "../agents/FilesystemModule";

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
      const fs = new FilesystemModule(agent.state);
      fs.setFiles(files);
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
      const fs = new FilesystemModule(agent.state);
      const op = fs.createOrUpdateFile(path, content);
      await agent.setState({
        ...agent.state,
        files: fs.getFileSystem(),
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
      const fs = new FilesystemModule(agent.state);
      const deleted = fs.deleteFile(path);
      await agent.setState({
        ...agent.state,
        files: fs.getFileSystem(),
      });
      if (!deleted) {
        return `File '${path}' does not exist.`;
      }
      return `File '${path}' has been deleted successfully.`;
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
