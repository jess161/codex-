import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({ build: { chunkSizeWarningLimit: 8000, rollupOptions: { input: { blade: resolve('index.html'), castaway: resolve('castaway.html') } } } });
