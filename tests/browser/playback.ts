import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';
import { mintToken } from '../../packages/server/dev-token/src/index';

const { values } = parseArgs({
  options: {
    web: { type: 'string', default: 'http://127.0.0.1:5173' },
    api: { type: 'string', default: 'http://127.0.0.1:3000' },
    'host-rules': { type: 'string', default: 'MAP minio 127.0.0.1' },
    'timeout-sec': { type: 'string', default: '180' },
  },
});

const FIXTURE = resolve(import.meta.dirname, '../fixtures/s2.mp4');
const TITLE = `Browser playback ${Date.now()}`;
const deadline = Date.now() + Number(values['timeout-sec']) * 1000;
const token = mintToken({ role: 'user', ttl: '1h' });

function step(text: string): void {
  process.stdout.write(`==> ${text}\n`);
}

async function statusOf(videoId: string): Promise<string> {
  const res = await fetch(`${values.api}/v1/videos/${videoId}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const body = (await res.json()) as { status?: string };
  return body.status ?? `HTTP ${res.status}`;
}

const browser = await chromium.launch({
  channel: 'chrome',
  args: [
    '--autoplay-policy=no-user-gesture-required',
    `--host-resolver-rules=${values['host-rules']}`,
  ],
});

try {
  const context = await browser.newContext({
    storageState: {
      cookies: [],
      origins: [{ origin: values.web, localStorage: [{ name: 'AUTH_TOKEN', value: token }] }],
    },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);

  step(`uploading ${FIXTURE} through ${values.web}/upload`);
  await page.goto(`${values.web}/upload`);
  await page.locator('input[type=file]').setInputFiles(FIXTURE);
  await page.locator('#title').fill(TITLE);
  await page.locator('#visibility').selectOption('public');
  await page.getByRole('button', { name: 'upload' }).click();
  const link = page.getByRole('link', { name: 'Go to the uploaded video page' });
  const href = await link.getAttribute('href');
  const videoId = href?.split('/').at(-1) ?? '';
  step(`uploaded video ${videoId}`);

  let status = await statusOf(videoId);
  while (status !== 'READY') {
    if (status === 'FAILED' || Date.now() > deadline)
      throw new Error(`video ${videoId} is ${status}`);
    await new Promise((settle) => setTimeout(settle, 500));
    status = await statusOf(videoId);
  }
  step('the video is READY');

  const rendered = await (await fetch(`${values.web}/watch/${videoId}`)).text();
  if (!rendered.includes(`<title>${TITLE}</title>`)) {
    throw new Error(
      'the SSR server rendered the watch page without the video it fetched from the API'
    );
  }
  step('the SSR server rendered the watch page with the video from the API');

  await link.click();
  await page.waitForFunction("(document.querySelector('video')?.currentTime ?? 0) > 1");
  step('the browser played the video past one second');
} finally {
  await browser.close();
}
