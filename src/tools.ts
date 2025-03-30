/**
 * Tool definitions for the AI chat agent
 * Tools can either require human confirmation or execute automatically
 */
import { tool } from "ai";
import { z } from "zod";

import { agentContext } from "./server";
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

/**
 * Tool to get the file system
 */
const getFileSystem = tool({
  description: "Get the current file system structure from the agent's state",
  parameters: z.object({}),
  execute: async () => {
    console.log("getFileSystem called");
    try {
      const agent = agentContext.getStore();
      if (!agent) {
        throw new Error("Agent context not found");
      }
      // Access state using agent.state
      const currentState = agent.state || {};
      const agentFileSystem = currentState.files || [];
      console.log("Retrieved file system from agent state:", agentFileSystem);
      return JSON.stringify(agentFileSystem);
    } catch (error) {
      console.error("Error getting file system from agent state:", error);
      return `Error getting file system: ${error}`;
    }
  },
});

// Define the FileItem schema recursively
const FileItemSchema: z.ZodType<any> = z.lazy(() => 
  z.object({
    id: z.string().describe("Unique identifier for the file or folder"),
    name: z.string().describe("Name of the file or folder"),
    type: z.enum(["file", "folder"]).describe("Type of item (file or folder)"),
    content: z.string().optional().describe("Content of the file (for files only)"),
    extension: z.string().optional().describe("File extension (for files only)"),
    children: z.array(FileItemSchema).optional().describe("Child items (for folders only)"),
    parentId: z.string().nullable().describe("ID of the parent folder")
  })
);

/**
 * Tool to set the file system
 */
const setFiles = tool({
  description: "Update the file system structure in the agent's state",
  parameters: z.object({
    files: z.array(FileItemSchema).describe("The new file system structure to set in the agent's state"),
  }),
  execute: async ({ files }) => {
    console.log("setFiles called with:", files);
    try {
      const agent = agentContext.getStore();
      if (!agent) {
        throw new Error("Agent context not found");
      }
      // Update state using agent.setState
      await agent.setState({ files: files });
      console.log("Agent file system state updated successfully.");
      return "Agent file system state updated successfully";
    } catch (error) {
      console.error("Error setting agent file system state:", error);
      return `Error setting file system: ${error}`;
    }
  },
});

/**
 * Tool to generate code for a file
 */
const generateCode = tool({
  description: "Generate code for a file based on its name and extension",
  parameters: z.object({
    fileName: z.string().describe("The name of the file"),
    extension: z.string().describe("The file extension"),
  }),
  execute: async ({ fileName, extension }) => {
    console.log(`generateCode called for ${fileName}.${extension}`);
    try {
      // Generate code based on file name and extension
      let code = "";
      
      switch (extension.toLowerCase()) {
        case 'js':
        case 'jsx':
          code = `// ${fileName}
// Generated on ${new Date().toISOString()}

/**
 * This is a JavaScript file generated by the AI assistant.
 * You can edit this file to add your own code.
 */

function main() {
  console.log("Hello from ${fileName}!");
  
  // Your code here
  
  return "Success!";
}

// Export the main function
export default main;
`;
          break;
        
        case 'ts':
        case 'tsx':
          code = `// ${fileName}
// Generated on ${new Date().toISOString()}

/**
 * This is a TypeScript file generated by the AI assistant.
 * You can edit this file to add your own code.
 */

interface Result {
  success: boolean;
  message: string;
}

function main(): Result {
  console.log("Hello from ${fileName}!");
  
  // Your code here
  
  return {
    success: true,
    message: "Operation completed successfully"
  };
}

// Export the main function
export default main;
`;
          break;
        
        case 'html':
          code = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fileName}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 20px;
      color: #333;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    header {
      background-color: #f4f4f4;
      padding: 1rem;
      margin-bottom: 1rem;
    }
    footer {
      margin-top: 2rem;
      text-align: center;
      font-size: 0.8rem;
      color: #777;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${fileName.split('.')[0]}</h1>
    </header>
    
    <main>
      <p>This is a generated HTML file. You can edit it to create your own content.</p>
      
      <section>
        <h2>Features</h2>
        <ul>
          <li>Responsive design</li>
          <li>Clean structure</li>
          <li>Easy to customize</li>
        </ul>
      </section>
    </main>
    
    <footer>
      <p>Generated on ${new Date().toLocaleDateString()}</p>
    </footer>
  </div>
  
  <script>
    // Your JavaScript code here
    console.log('Page loaded successfully!');
  </script>
</body>
</html>`;
          break;
        
        case 'css':
          code = `/* ${fileName}
 * Generated on ${new Date().toISOString()}
 * 
 * This is a CSS file generated by the AI assistant.
 * You can edit this file to add your own styles.
 */

/* Reset and base styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  line-height: 1.6;
  color: #333;
  background-color: #f9f9f9;
}

.container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 15px;
}

/* Typography */
h1, h2, h3, h4, h5, h6 {
  margin-bottom: 0.5em;
  font-weight: 600;
  line-height: 1.3;
}

h1 {
  font-size: 2.5rem;
}

h2 {
  font-size: 2rem;
}

p {
  margin-bottom: 1rem;
}

/* Buttons */
.button {
  display: inline-block;
  padding: 0.5rem 1rem;
  background-color: #0066cc;
  color: white;
  text-decoration: none;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.button:hover {
  background-color: #0052a3;
}

/* Responsive utilities */
@media (max-width: 768px) {
  h1 {
    font-size: 2rem;
  }
  
  h2 {
    font-size: 1.5rem;
  }
}
`;
          break;
        
        case 'md':
          code = `# ${fileName.split('.')[0]}

Generated on ${new Date().toLocaleDateString()}

## Overview

This is a Markdown file generated by the AI assistant. You can edit this file to add your own content.

## Features

- Easy to read
- Supports formatting
- Compatible with GitHub

## Code Example

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('World'));
\`\`\`

## Table Example

| Name | Type | Description |
|------|------|-------------|
| id | string | Unique identifier |
| name | string | Display name |
| created | date | Creation timestamp |

## Next Steps

1. Edit this file
2. Add your own content
3. Save and commit changes

---

Generated by AI Assistant
`;
          break;
        
        default:
          code = `// ${fileName}
// Generated on ${new Date().toISOString()}

/**
 * This is a file generated by the AI assistant.
 * You can edit this file to add your own code.
 */

// Your code here
`;
      }
      
      return code;
    } catch (error) {
      console.error("Error generating code:", error);
      return `Error generating code: ${error}`;
    }
  },
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
  generateCode,
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
