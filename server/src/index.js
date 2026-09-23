import { createApp } from './app.js';
import { buildProcessedData } from './processor.js';

const port = Number(process.env.PORT || 3001);
await buildProcessedData();
createApp().listen(port, '127.0.0.1', () => {
  console.log(`DynastyBot API listening at http://127.0.0.1:${port}`);
});
