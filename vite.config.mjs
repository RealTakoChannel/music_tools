import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Pages supplies its path prefix; local builds remain portable.
  base:
    process.env.PAGES_BASE_PATH === undefined
      ? './'
      : `${process.env.PAGES_BASE_PATH.replace(/\/$/, '')}/`,
});
