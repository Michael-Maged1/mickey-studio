import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const outputUrl = new URL('./dist/', import.meta.url);
await rm(outputUrl, { recursive: true, force: true });
await mkdir(outputUrl, { recursive: true });

const rootFiles = [
  'index.html',
  'extension.html',
  'admin.html',
  'app.js',
  'style.css',
  'motion-editor.html',
  'motion-editor.js',
  'motion-editor.css',
  'mickey-job-queue.js',
  'mickey-telemetry.js',
  'mickey-tooltip.js',
  'ui-strings.js',
  'privacy.html',
  'terms.html',
  'robots.txt',
  'sitemap.xml',
  'manifest.json',
  'sw.js'
];

for (const file of rootFiles) {
  const src = new URL(`./${file}`, import.meta.url);
  if (existsSync(src)) {
    await cp(src, new URL(`./dist/${file}`, import.meta.url));
  }
}

for (const dir of ['assets', 'studios', 'shared']) {
  const srcDir = new URL(`./${dir}/`, import.meta.url);
  if (existsSync(srcDir)) {
    await cp(srcDir, new URL(`./dist/${dir}/`, import.meta.url), { recursive: true });
  }
}

const configuredApi = (process.env.MICKEY_API_BASE_URL || 'https://mickey-studio-api.kma279500.workers.dev/api.php').trim();
let apiBase = '';
if (configuredApi) {
  const parsed = new URL(configuredApi);
  if (parsed.protocol !== 'https:') throw new Error('MICKEY_API_BASE_URL must use HTTPS.');
  apiBase = parsed.href.replace(/\/$/, '');
}
await writeFile(new URL('./dist/api-config.js', import.meta.url), `window.MICKEY_API_BASE_URL = ${JSON.stringify(apiBase)};\n`);
