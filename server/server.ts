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
import { tools, executions } from "./tools/index";
import { AsyncLocalStorage } from "node:async_hooks";
import { generateSystemPrompt } from "./constants/system-prompt";
import { handleApiRequest } from "./router";
import type { ExecutionContext, ExportedHandler, Request as CfRequest, Response as CfResponse, IncomingRequestCfProperties } from "@cloudflare/workers-types";
// import { env } from "cloudflare:workers";

const model = openai("gpt-4o-2024-11-20");
// Cloudflare AI Gateway
// const openai = createOpenAI({
//   apiKey: env.OPENAI_API_KEY,
//   baseURL: env.GATEWAY_BASE_URL,
// });

// we use ALS to expose the agent context to the tools
export const agentContext = new AsyncLocalStorage<Chat>();

// Import agent state type
import type { AgentState } from "./types";

/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<Env, AgentState> {
  // Set the initial state for the agent
  initialState: AgentState = {
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

          // Get the schedule prompt
          const schedulePrompt = unstable_getSchedulePrompt({ date: new Date() });
          
          // Use a default agent name since we can't access the request URL here
          const agentName = 'wai-1';
          
          // Stream the AI response using GPT-4
          const result = streamText({
            model,
            system: generateSystemPrompt(new Date(), schedulePrompt, agentName),
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

    // Handle API requests using the router
    const apiResponse = await handleApiRequest(request, env, ctx);
    if (apiResponse) {
      return apiResponse;
    }
    

    return (
      // Route the request to our agent or return 404 if not found
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
