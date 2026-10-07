import { build } from 'esbuild';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

// Bundle without ES modules so the downloaded artifact also works via file://.
const result = await build({
  entryPoints: ['src/main.jsx'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  outdir: 'dist/offline',
  write: false,
  minify: true,
  target: ['es2020'],
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.css': 'empty' },
});
const js = result.outputFiles
  .find((file) => file.path.endsWith('.js'))
  .text.replace(/<\/script/gi, '<\\/script');
// Reuse Vite's compiled Tailwind CSS rather than embedding unprocessed directives.
const cssFiles = (await readdir('dist/assets')).filter((file) => file.endsWith('.css')).sort();
if (!cssFiles.length) throw new Error('Build the Tailwind stylesheet with Vite first.');
const css = (
  await Promise.all(cssFiles.map((file) => readFile(`dist/assets/${file}`, 'utf8')))
).join('\n');
await mkdir('dist/offline', { recursive: true });
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#090b10"><meta name="description" content="Music Tools"><title>Music Tools</title><style>${css}</style></head><body><div id="root"></div><script>${js}</script></body></html>`;
await writeFile('dist/offline/index.html', html);
// Old bookmarks lead to the same SPA, without shipping separate React pages.
for (const tool of ['audiojoin', 'bpmcalc', 'cashier']) {
  await mkdir(`dist/${tool}`, { recursive: true });
  await copyFile(`${tool}/index.html`, `dist/${tool}/index.html`);
}
await copyFile('CNAME', 'dist/CNAME');
await writeFile(
  'dist/offline/使用说明.txt',
  '双击 index.html 打开 Music Tools。单个 HTML 包含所有工具，通过顶部导航切换；无需其他文件或联网。切换工具会保留本次会话的文件、输入和结果，关闭或刷新后清空。文件仅在本机处理。\n',
);
console.log('Single-page offline app, legacy redirects and hosting domain generated.');
