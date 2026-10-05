import { defineConfig } from 'vite';

// es2022 for top-level await (main.js waits for the label font).
export default defineConfig({
  build: { target: 'es2022', chunkSizeWarningLimit: 700 }, // three.js alone is ~500 kB
  server: { port: 3200 },
});
