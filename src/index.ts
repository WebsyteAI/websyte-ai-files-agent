import { Hono } from 'hono';

const app = new Hono();

// Endpoint to schedule a log every minute
app.post('/schedule-log', async (c) => {
  const { scheduleTask } = c.env;

  // Schedule a task to log a message every minute
  const task = await scheduleTask({
    description: 'Log a message every minute',
    when: {
      type: 'cron',
      cron: '* * * * *',
    },
  });

  return c.json({ message: 'Task scheduled', task });
});

// Endpoint to view current scheduled tasks
app.get('/tasks', async (c) => {
  const { listScheduledTasks } = c.env;

  // Retrieve the list of scheduled tasks
  const tasks = await listScheduledTasks();

  return c.json({ tasks });
});

export default app;