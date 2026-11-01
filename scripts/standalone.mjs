import fs from 'node:fs/promises';
import { build } from 'vite';
import { bladeRelease } from './blade-release.mjs';

// Separate builds give each offline game a self-contained bundle with embedded images.
for (const [input, filename] of [['index.html', 'blade-evolution.html'], ['castaway.html', 'castaway.html']]) {
  const result = await build({ configFile: false, define:input==='index.html'?{__BLADE_RELEASE__:JSON.stringify(bladeRelease())}:{}, logLevel: 'error', build: { write: false, assetsInlineLimit: Infinity, rollupOptions: { input, output: { inlineDynamicImports: true } } } });
  const output = Array.isArray(result) ? result[0].output : result.output;
  let html = output.find(item => item.type === 'asset' && item.fileName.endsWith('.html')).source;
  for (const item of output) {
    if (item.type === 'chunk') html = html.replace(/<script[^>]*src="[^"]+"[^>]*><\/script>/, () => `<script>${item.code.replace(/<\/script/gi, '<\\/script')}</script>`);
    if (item.type === 'asset' && item.fileName.endsWith('.css')) html = html.replace(/<link[^>]*rel="stylesheet"[^>]*>/, () => `<style>${item.source}</style>`);
  }
  html = html.replace(/<link[^>]*rel="modulepreload"[^>]*>/g, '');
  const favicon = await fs.readFile(input === 'index.html' ? 'public/blade-icon.svg' : 'public/favicon.svg', 'utf8');
  html = html.replace(/href="\/(blade-icon|favicon)\.svg"/, () => `href="data:image/svg+xml,${encodeURIComponent(favicon)}"`);
  const script = html.match(/<script>[\s\S]*?<\/script>/)?.[0];
  if (!script) throw new Error(`Missing bundle for ${input}`);
  html = html.replace(script, '').replace('</body>', () => `${script}\n</body>`);
  await fs.writeFile(`dist/${filename}`, html);
  console.log(`Offline game: dist/${filename} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB)`);
}
