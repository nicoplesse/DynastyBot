import { createApp } from './app.js';
import { buildProcessedData } from './processor.js';

// Mirrors frontend/vite.config: with an assigned PORT the API sits 1000 above it.
const port = Number(process.env.API_PORT) || (process.env.PORT ? Number(process.env.PORT) + 1000 : 3001);
await buildProcessedData();
createApp().listen(port, '127.0.0.1', () => {
  console.log(`DynastyBot API listening at http://127.0.0.1:${port}`);
});
