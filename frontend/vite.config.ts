import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// A preview launcher may assign PORT; the API then moves 1000 above it so parallel dev servers don't collide.
const port = Number(process.env.PORT) || 5173;
const apiPort = Number(process.env.API_PORT) || (process.env.PORT ? port + 1000 : 3001);

export default defineConfig({
  plugins: [react()],
  server: { port, strictPort: Boolean(process.env.PORT), proxy: { '/api': `http://127.0.0.1:${apiPort}` } },
});
