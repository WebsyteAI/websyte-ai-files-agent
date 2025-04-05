import { Hono } from 'hono';
import { cors } from 'hono/cors';

interface Env {
  QUOTES_KV: KVNamespace;
}

const app = new Hono<{ Bindings: Env }>();

// Enable CORS
app.use('*', cors());

// GET /quotes - Fetch a random quote
app.get('/quotes', async (c) => {
  try {
    const keys = await c.env.QUOTES_KV.list();
    if (keys.keys.length === 0) {
      return c.json({ message: 'No quotes available.' }, 404);
    }

    const randomKey = keys.keys[Math.floor(Math.random() * keys.keys.length)].name;
    const quote = await c.env.QUOTES_KV.get(randomKey);

    return c.json({ quote });
  } catch (error) {
    console.error('Error fetching quote:', error);
    return c.json({ error: 'Failed to fetch quote.' }, 500);
  }
});

// POST /quotes - Add a new quote
app.post('/quotes', async (c) => {
  try {
    const body = await c.req.json<{ quote: string }>();
    if (!body.quote) {
      return c.json({ error: 'Quote is required.' }, 400);
    }

    const id = crypto.randomUUID();
    await c.env.QUOTES_KV.put(id, body.quote);

    return c.json({ message: 'Quote added successfully.', id });
  } catch (error) {
    console.error('Error adding quote:', error);
    return c.json({ error: 'Failed to add quote.' }, 500);
  }
});

export default app;