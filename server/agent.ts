// websyte-ai-files-agent/server/agent.ts
import { type Schedule, type Connection, type ConnectionContext } from "agents";
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
import type { AgentState } from "./types";

const model = openai("gpt-4o-2024-11-20");
// Cloudflare AI Gateway
// const openai = createOpenAI({
//   apiKey: env.OPENAI_API_KEY,
//   baseURL: env.GATEWAY_BASE_URL,
// });

// we use ALS to expose the agent context to the tools
export const agentContext = new AsyncLocalStorage<Chat>();

/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<Env, AgentState> {
  // Set the initial state for the agent
  initialState: AgentState = {
    files: {},
    agentName: "", // Will be set from request
    github: {
      owner: "WebsyteAI", // Default GitHub owner
      branch: "main", // Default GitHub branch
    },
    dispatchNamespace: process.env.DISPATCH_NAMESPACE_NAME || "", // Set from environment variable
    dispatchNamespaceAccountId: process.env.DISPATCH_NAMESPACE_ACCOUNT_ID || "", // Set from environment variable
  };

  /**
   * Handle HTTP requests to the agent
   * Extracts and validates the agentName from the request headers
   */
  async onRequest(request: Request): Promise<Response> {
    // Extract agentName from the x-partykit-room header
    const partyKitRoom = request.headers.get("x-partykit-room");

    // Use the header value as the agentName
    const agentName = partyKitRoom;

    // Validate agentName
    if (!agentName) {
      return new Response(
        "Agent name is required (x-partykit-room header missing)",
        { status: 400 }
      );
    }

    console.log('init state', this.state);

    // Update agent state with the agentName if it's not already set
    if (!this.state.agentName) {
      await this.setState({
        ...this.state,
        agentName,
      });
    }

    console.log('init state', this.state);

    // Continue with normal request processing
    return await super.onRequest(request);
  }

  /**
   * Handle WebSocket connections to the agent
   * Extracts and validates the agentName from the connection request headers
   */
  async onConnect(
    connection: Connection,
    ctx: ConnectionContext
  ): Promise<void> {
    // Extract agentName from the x-partykit-room header
    const partyKitRoom = ctx.request.headers.get("x-partykit-room");

    // Use the header value as the agentName
    const agentName = partyKitRoom;

    // Validate agentName
    if (!agentName) {
      connection.close(
        1008,
        "Agent name is required (x-partykit-room header missing)"
      );
      return;
    }

    // Update agent state with the agentName if it's not already set
    if (!this.state.agentName) {
      await this.setState({
        ...this.state,
        agentName,
      });
    }

    // Continue with normal connection handling
    await super.onConnect(connection, ctx);
  }

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
          const schedulePrompt = unstable_getSchedulePrompt({
            date: new Date(),
          });

          const agentName = this.state.agentName || '';

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
