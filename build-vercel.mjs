import { cp, mkdir, writeFile } from 'node:fs/promises';

const output = new URL('./dist/', import.meta.url);
await mkdir(output, { recursive: true });
for (const file of ['index.html', 'admin.html', 'app.js', 'style.css']) {
  await cp(new URL(`./${file}`, import.meta.url), new URL(`./dist/${file}`, import.meta.url));
}

const configuredApi = (process.env.MICKEY_API_BASE_URL || '').trim();
let apiBase = '';
if (configuredApi) {
  const parsed = new URL(configuredApi);
  if (parsed.protocol !== 'https:') throw new Error('MICKEY_API_BASE_URL must use HTTPS.');
  apiBase = parsed.href.replace(/\/$/, '');
}
await writeFile(new URL('./dist/api-config.js', import.meta.url), `window.MICKEY_API_BASE_URL = ${JSON.stringify(apiBase)};\n`);

