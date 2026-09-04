import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
// norelock.lol
export default defineConfig({
  plugins: [solid(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          // three is only used by the two decorative visuals; keeping it out of
          // the entry chunk means the page can render before it arrives.
          if (id.includes('/three/')) return 'three';
          if (id.includes('/solid-js/') || id.includes('/@solidjs/')) return 'solid';
          return 'vendor';
        },
      },
    },
  },
});
