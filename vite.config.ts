import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { bladeRelease } from './scripts/blade-release.mjs';
export default defineConfig({ define:{__BLADE_RELEASE__:JSON.stringify(bladeRelease())}, build: { chunkSizeWarningLimit: 8000, rollupOptions: { input: { blade: resolve('index.html'), castaway: resolve('castaway.html') } } } });
