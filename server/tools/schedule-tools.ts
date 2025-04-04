/**
 * Scheduling tools for the AI chat agent
 * Handles task scheduling and management
 */
import { tool } from "ai";
import { z } from "zod";
import { agentContext } from "../agent";
import {
  unstable_getSchedulePrompt,
  unstable_scheduleSchema,
} from "agents/schedule";

/**
 * Tool to schedule a task for future execution
 */
export const scheduleTask = tool({
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
export const removeScheduledTask = tool({
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
export const listScheduledTasks = tool({
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

      const tasksInfo = schedules
        .map((schedule) => {
          let timeInfo = "";

          // Handle different schedule types
          if ("type" in schedule) {
            if (schedule.type === "scheduled" && "time" in schedule) {
              const date = new Date(schedule.time);
              timeInfo = `scheduled for ${date.toLocaleString()}`;
            } else if (schedule.type === "cron" && "cron" in schedule) {
              timeInfo = `recurring with cron pattern: ${schedule.cron}`;
            } else if (schedule.type === "delayed" && "delay" in schedule) {
              timeInfo = `delayed by ${schedule.delay} seconds`;
            }
          }

          return `- ID: ${schedule.id}, ${timeInfo}, Callback: ${schedule.callback}, Payload: ${schedule.payload}`;
        })
        .join("\n");

      return `Scheduled tasks:\n${tasksInfo}`;
    } catch (error) {
      console.error("Error listing scheduled tasks:", error);
      return `Error listing scheduled tasks: ${error}`;
    }
  },
});

// Export all scheduling tools
export const scheduleTools = {
  scheduleTask,
  removeScheduledTask,
  listScheduledTasks,
};
