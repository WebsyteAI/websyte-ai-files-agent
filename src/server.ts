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

// Helper function to upload worker script to Cloudflare Dispatch Namespace
async function uploadWorkerScript(
	env: Env,
	scriptName: string,
	scriptContent: string,
): Promise<{ success: boolean; errors?: any[] }> {
	const accountId = env.CLOUDFLARE_ACCOUNT_ID;
	const apiToken = env.CLOUDFLARE_API_TOKEN;
	const namespace = "testing"; // As defined in wrangler.jsonc

	if (!accountId || !apiToken) {
		console.error(
			"Cloudflare Account ID or API Token not configured in environment.",
		);
		return {
			success: false,
			errors: ["Cloudflare credentials not configured."],
		};
	}

	const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/dispatch/namespaces/${namespace}/scripts/${scriptName}`;

	// Use FormData to upload the script content
	const formData = new FormData();
	formData.append(
		"metadata",
		JSON.stringify({ main_module: "index.js" }), // Assuming ES module format
	);
	formData.append("index.js", new Blob([scriptContent]), "index.js");

	try {
		const response = await fetch(apiUrl, {
			method: "PUT",
			headers: {
				Authorization: `Bearer ${apiToken}`,
				// Content-Type is set automatically by fetch when using FormData
			},
			body: formData,
		});

		if (!response.ok) {
			const errorData = await response.json();
			console.error(
				`Failed to upload worker script ${scriptName}:`,
				response.status,
				response.statusText,
				errorData,
			);
			// Ensure errorData is treated as potentially having an 'errors' property
			const apiErrors = (errorData as any)?.errors;
			return {
				success: false,
				errors: Array.isArray(apiErrors) && apiErrors.length > 0
					? apiErrors
					: [{ message: response.statusText || "Unknown API error" }],
			};
		}

		console.log(`Successfully uploaded worker script: ${scriptName}`);
		return { success: true };
	} catch (error) { // Keep type as unknown or any for broader catch
		console.error(`Error uploading worker script ${scriptName}:`, error);
		// Ensure error has a message property before accessing it
		const errorMessage = error instanceof Error ? error.message : String(error);
		return { success: false, errors: [{ message: errorMessage }] };
	}
}

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
  files: any[];
};

/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<Env, State> {
  // Set the initial state for the agent
  initialState: State = {
    files: [],
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

If the user asks to schedule a task, use the schedule tool to schedule the task.
If the user asks to remove or cancel a scheduled task, use the removeScheduledTask tool with the task ID.
If the user asks to list or view scheduled tasks, use the listScheduledTasks tool to show all scheduled tasks.

You can also help the user with file management. You can create, edit, and delete files in the file system.
ALWAYS add code as files to the file system unless asked otherwise. You can use the getFileSystem tool to view the current file system structure.

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

    return (
      // Route the request to our agent or return 404 if not found
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;

// Helper function to extract subdomain
function getWorkerIdFromSubdomain(
	request: CfRequest<unknown, IncomingRequestCfProperties>,
	baseDomain: string,
): string | null {
	const url = new URL(request.url);
	const hostname = url.hostname;

	if (hostname.endsWith(`.${baseDomain}`)) {
		const parts = hostname.split(".");
		// Check if it's a direct subdomain (e.g., worker-id.base.com)
		if (parts.length === 3) {
			return parts[0];
		}
	}
	return null;
}
