import { Hono } from 'hono';

const app = new Hono();

// Array of jokes
const jokes = [
  { id: 1, joke: 'Why don’t skeletons fight each other? They don’t have the guts.' },
  { id: 2, joke: 'What do you call cheese that isn’t yours? Nacho cheese.' },
  { id: 3, joke: 'Why couldn’t the bicycle stand up by itself? It was two tired.' },
  { id: 4, joke: 'What did the grape do when he got stepped on? Nothing but let out a little wine.' },
  { id: 5, joke: 'Why don’t scientists trust atoms? Because they make up everything!' }
];

// Get all jokes
app.get('/jokes', (c) => {
  return c.json(jokes);
});

// Get a random joke
app.get('/jokes/random', (c) => {
  const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
  return c.json(randomJoke);
});

// Get a joke by ID
app.get('/jokes/:id', (c) => {
  const id = parseInt(c.req.param('id'));
  const joke = jokes.find((j) => j.id === id);
  if (joke) {
    return c.json(joke);
  } else {
    return c.json({ error: 'Joke not found' }, 404);
  }
});

export default app;