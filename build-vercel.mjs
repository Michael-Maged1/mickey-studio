import { cp, mkdir, rm, writeFile } from 'node:fs/promises';

const output = new URL('./dist/', import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of [
  'index.html', 'admin.html', 'app.js', 'style.css',
  'motion-editor.html', 'motion-editor.js', 'motion-editor.css',
  'privacy.html', 'terms.html', 'ui-strings.js',
  'mickey-job-queue.js', 'mickey-telemetry.js', 'mickey-tooltip.js'
]) {
  await cp(new URL(`./${file}`, import.meta.url), new URL(`./dist/${file}`, import.meta.url));
}
for (const directory of ['assets', 'shared', 'studios']) {
  await cp(new URL(`./${directory}/`, import.meta.url), new URL(`./dist/${directory}/`, import.meta.url), { recursive: true });
}

const configuredApi = (process.env.MICKEY_API_BASE_URL || '').trim();
if (configuredApi) {
  const parsed = new URL(configuredApi);
  if (parsed.protocol !== 'https:') throw new Error('MICKEY_API_BASE_URL must use HTTPS.');
  const apiBase = parsed.href.replace(/\/$/, '');
  await writeFile(new URL('./dist/api-config.js', import.meta.url), `window.MICKEY_API_BASE_URL = ${JSON.stringify(apiBase)};\n`);
} else {
  await cp(new URL('./api-config.js', import.meta.url), new URL('./dist/api-config.js', import.meta.url));
}

