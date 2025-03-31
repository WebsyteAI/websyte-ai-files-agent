import { routeAgentRequest, type Schedule } from "agents";

import { unstable_getSchedulePrompt } from "agents/schedule";

import { AIChatAgent } from "agents/ai-chat-agent";
import {
  createDataStreamResponse,
  generateId,
  streamText,
  type StreamTextOnFinishCallback,
} from "ai";
import { openai } from "@ai-sdk/openai";
import { processToolCalls } from "./utils";
import { tools, executions } from "./tools";
import { AsyncLocalStorage } from "node:async_hooks";
import CloudflareSystemPrompt from "./cloudflare-system-context.txt";
import type { ExecutionContext, ExportedHandler, Request as CfRequest, Response as CfResponse, IncomingRequestCfProperties } from "@cloudflare/workers-types"; // Added import
// import { env } from "cloudflare:workers";

const model = openai("gpt-4o-2024-11-20");
// Cloudflare AI Gateway
// const openai = createOpenAI({
//   apiKey: env.OPENAI_API_KEY,
//   baseURL: env.GATEWAY_BASE_URL,
// });

// we use ALS to expose the agent context to the tools
export const agentContext = new AsyncLocalStorage<Chat>();

// Define the state structure for the agent
type State = {
  files: Record<string, {
    content: string;
    created: string;
    modified: string;
    streaming?: boolean;
  }>;
};

/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<Env, State> {
  // Set the initial state for the agent
  initialState: State = {
    files: {},
  };

  /**
   * Handles incoming chat messages and manages the response stream
   * @param onFinish - Callback function executed when streaming completes
   */
  // biome-ignore lint/complexity/noBannedTypes: <explanation>
  async onChatMessage(onFinish: StreamTextOnFinishCallback<{}>) {
    // Create a streaming response that handles both text and tool outputs
    return agentContext.run(this, async () => {
      const dataStreamResponse = createDataStreamResponse({
        execute: async (dataStream) => {
          // Process any pending tool calls from previous messages
          // This handles human-in-the-loop confirmations for tools
          const processedMessages = await processToolCalls({
            messages: this.messages,
            dataStream,
            tools,
            executions,
          });

          // Stream the AI response using GPT-4
          const result = streamText({
            model,
            system: `
${CloudflareSystemPrompt}

---

${unstable_getSchedulePrompt({ date: new Date() })}

---

If the user asks to schedule a task, use the schedule tool to schedule the task.
If the user asks to remove or cancel a scheduled task, use the removeScheduledTask tool with the task ID.
If the user asks to list or view scheduled tasks, use the listScheduledTasks tool to show all scheduled tasks.

You can also help the user with file management. You can create, edit, and delete files in the file system.
ALWAYS add code as files to the file system unless asked otherwise. You can use the getFileSystem tool to view the current file system structure.
DON'T display code in the chat unless asked by the user.

The file system is organized as a flat structure where each file is identified by its path:
- Use paths like "src/index.ts", "public/styles.css", or "wrangler.jsonc" as unique identifiers
- Each file has content, creation timestamp, and last modified timestamp
- Use the createOrUpdateFile tool to create new files or update existing ones
  - Set the stream parameter to true to enable real-time streaming of file content
  - For large files, streaming provides a better user experience as content appears incrementally
- Use the streamFileChunk tool to append content to a streaming file
- Use the deleteFile tool to remove files from the system
- Use the getFileSystem tool to view the current file structure

When working with files:
- Always use forward slashes (/) in file paths, even on Windows
- Include the file extension in the path
- Organize files in logical directories (e.g., src/, public/, config/)

Repo info:
ALWAYS use the parameters below for the github tool.
org: WebsyteAI
repo: wai-1
commit message: {generate one}

If a user asks for many features at once, you do not have to implement them all as long as the ones you implement are FULLY FUNCTIONAL and you clearly communicate to the user that you didn't implement some specific features.

DO NOT OVERENGINEER THE CODE. You take great pride in keeping things simple and elegant. You don't start by writing very complex error handling, fallback mechanisms, etc. You focus on the user's request and make the minimum amount of changes needed.
DON'T DO MORE THAN WHAT THE USER ASKS FOR.
`,
            messages: processedMessages,
            tools,
            onFinish,
            onError: (error) => {
              console.error("Error while streaming:", error);
            },
            maxSteps: 10,
          });

          // Merge the AI response stream with tool execution outputs
          result.mergeIntoDataStream(dataStream);
        },
      });

      return dataStreamResponse;
    });
  }

  async executeTask(description: string, task: Schedule<string>) {
    console.log(`Executing scheduled task: ${description}, ID: ${task.id}`);

    // Add a message to the chat about the executed task
    await this.saveMessages([
      ...this.messages,
      {
        id: generateId(),
        role: "user",
        content: `Running scheduled task: ${description}`,
        createdAt: new Date(),
      },
    ]);

    // If the task is a one-time task, we can remove it after execution
    // For recurring tasks (cron), we keep them
    if (task.type !== "cron") {
      try {
        await this.cancelSchedule(task.id);
        console.log(`Removed one-time task after execution: ${task.id}`);
      } catch (error) {
        console.error(`Error removing task ${task.id}:`, error);
      }
    }
  }
}

/**
 * Worker entry point that routes incoming requests to the appropriate handler
 */
export default {
  // @ts-ignore
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    if (!process.env.OPENAI_API_KEY) {
      console.error(
        "OPENAI_API_KEY is not set, don't forget to set it locally in .dev.vars, and use `wrangler secret bulk .dev.vars` to upload it to production"
      );
      return new Response("OPENAI_API_KEY is not set", { status: 500 });
    }

    // Handle API requests
    const url = new URL(request.url);
    
    // Handle tool execution API endpoint
    if (url.pathname === '/api/agent/tool' && request.method === 'POST') {
      try {
        const data = await request.json();
        const { tool: toolName, params } = data;
        
        if (!toolName) {
          return new Response(
            JSON.stringify({ success: false, message: 'Tool name is required' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        
        // Check if the tool exists
        if (!tools[toolName as keyof typeof tools]) {
          return new Response(
            JSON.stringify({ success: false, message: `Tool '${toolName}' not found` }),
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
            
            return new Response(
              JSON.stringify({ success: true, content: result }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          } catch (error) {
            console.error(`Error executing tool '${toolName}':`, error);
            return new Response(
              JSON.stringify({ 
                success: false, 
                message: error instanceof Error ? error.message : String(error) 
              }),
              { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
          }
        });
      } catch (error) {
        console.error('Error in tool execution endpoint:', error);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: error instanceof Error ? error.message : 'Unknown error' 
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
    

    return (
      // Route the request to our agent or return 404 if not found
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
