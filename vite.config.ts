import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { bladeRelease } from './scripts/blade-release.mjs';
export default defineConfig(({mode}) => ({ define:{__BLADE_RELEASE__:JSON.stringify(bladeRelease())}, build: { chunkSizeWarningLimit: 8000, rollupOptions: { input: mode==='blade'?{blade:resolve('index.html')}:{ blade: resolve('index.html'), castaway: resolve('castaway.html') } } } }));
