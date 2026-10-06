import { defineConfig } from 'vite';

// es2022 for top-level await (main.js waits for the label font).
export default defineConfig({
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 700, // three.js alone is ~500 kB
    // three.js gets its own chunk: game updates change only the small app chunk,
    // so returning visitors keep the big one cached.
    rollupOptions: { output: { manualChunks: (id) => (id.includes('node_modules/three') ? 'three' : undefined) } },
  },
  server: { port: 3200 },
});
