// websyte-ai-files-agent/server/agents/ChatAgent.ts
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
import { processToolCalls } from "../utils";
import { tools, executions } from "../tools/index";
import { AsyncLocalStorage } from "node:async_hooks";
import { generateSystemPrompt } from "../constants/system-prompt";
import type { AgentState, Env } from "../types";

// Import domain modules (to be implemented)
import { FilesystemModule } from "./FilesystemModule";
import { GitHubModule } from "./GitHubModule";
import { SchedulerModule } from "./SchedulerModule";

const model = openai("gpt-4.1");

// we use ALS to expose the agent context to the tools
export const agentContext = new AsyncLocalStorage<ChatAgent>();

/**
 * ChatAgent implementation that handles real-time AI chat interactions
 * and delegates domain logic to modules, all sharing the same state.
 */
export class ChatAgent extends AIChatAgent<Env, AgentState> {
  // Set the initial state for the agent
  initialState: AgentState = {
    files: {},
    agentName: "",
    github: {
      owner: "WebsyteAI",
      branch: "main",
    },
    dispatchNamespace: process.env.DISPATCH_NAMESPACE_NAME || "",
    dispatchNamespaceAccountId: process.env.DISPATCH_NAMESPACE_ACCOUNT_ID || "",
  };

  // Domain modules (all share the same state)
  filesystem: FilesystemModule;
  github: GitHubModule;
  scheduler: SchedulerModule;

  constructor(ctx: any, env: Env) {
    super(ctx, env);
    // Pass the shared state to each module
    this.filesystem = new FilesystemModule(this.state);
    this.github = new GitHubModule(this.state);
    this.scheduler = new SchedulerModule(this.state);
  }

  async onRequest(request: Request): Promise<Response> {
    const partyKitRoom = request.headers.get("x-partykit-room");
    const agentName = partyKitRoom;
    if (!agentName) {
      return new Response(
        "Agent name is required (x-partykit-room header missing)",
        { status: 400 }
      );
    }
    if (!this.state.agentName) {
      await this.setState({
        ...this.state,
        agentName,
      });
    }
    return await super.onRequest(request);
  }

  async onConnect(
    connection: Connection,
    ctx: ConnectionContext
  ): Promise<void> {
    const partyKitRoom = ctx.request.headers.get("x-partykit-room");
    const agentName = partyKitRoom;
    if (!agentName) {
      connection.close(
        1008,
        "Agent name is required (x-partykit-room header missing)"
      );
      return;
    }
    if (!this.state.agentName) {
      await this.setState({
        ...this.state,
        agentName,
      });
    }
    await super.onConnect(connection, ctx);
  }

  async onChatMessage(onFinish: StreamTextOnFinishCallback<{}>) {
    return agentContext.run(this, async () => {
      const dataStreamResponse = createDataStreamResponse({
        execute: async (dataStream) => {
          const processedMessages = await processToolCalls({
            messages: this.messages,
            dataStream,
            tools,
            executions,
          });
          const schedulePrompt = unstable_getSchedulePrompt({
            date: new Date(),
          });
          const agentName = this.state.agentName || '';
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
          result.mergeIntoDataStream(dataStream);
        },
      });
      return dataStreamResponse;
    });
  }

  async executeTask(description: string, task: Schedule<string>) {
    console.log(`Executing scheduled task: ${description}, ID: ${task.id}`);
    await this.saveMessages([
      ...this.messages,
      {
        id: generateId(),
        role: "user",
        content: `Running scheduled task: ${description}`,
        createdAt: new Date(),
      },
    ]);
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
