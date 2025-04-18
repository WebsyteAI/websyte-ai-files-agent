// websyte-ai-files-agent/server/ExampleWorkflow.ts

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';

interface Env {
  // Add any bindings you want to use here (KV, D1, etc.)
  // Example: FILES_KV: KVNamespace;
}

// Define the type for the workflow input parameters
type Params = {
  userId: string;
  action: string;
};

export class ExampleWorkflow extends WorkflowEntrypoint<Env, Params> {
  // The main workflow logic
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    // Log the start of the workflow
    console.log('ExampleWorkflow started', { params: event.payload });

    // Step 1: Simulate a task (e.g., fetch user data)
    const userData = await step.do('fetch user data', async () => {
      // Simulate fetching user data (replace with real logic)
      return {
        userId: event.payload.userId,
        name: 'Test User',
        timestamp: new Date().toISOString(),
      };
    });

    // Step 2: Simulate another task (e.g., perform an action)
    const result = await step.do('perform action', async () => {
      if (event.payload.action === 'fail') {
        // Demonstrate error handling
        throw new Error('Simulated action failure');
      }
      // Simulate a successful action
      return {
        status: 'success',
        action: event.payload.action,
        performedAt: new Date().toISOString(),
      };
    });

    // Step 3: Optionally wait (simulate async work)
    await step.sleep('wait for 2 seconds', '2 seconds');

    // Step 4: Finalize
    return {
      message: 'Workflow completed',
      user: userData,
      result,
    };
  }
}

export default ExampleWorkflow;
