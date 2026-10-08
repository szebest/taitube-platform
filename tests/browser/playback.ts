import { execFileSync } from 'node:child_process';
import { type Server, createConnection, createServer } from 'node:net';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';
import { mintToken } from '../../packages/server/dev-token/src/index';

const { values } = parseArgs({
  options: {
    web: { type: 'string', default: 'http://localhost:5173' },
    api: { type: 'string', default: 'http://localhost:3000' },
    'host-rules': { type: 'string', default: 'MAP minio 127.0.0.1' },
    'timeout-sec': { type: 'string', default: '180' },
  },
});

/**
 * What the browser reaches on the host: the web page, the API it calls and MinIO, which it uploads to and
 * plays from. Docker publishes no port on the offline overlay's internal network, so a port nothing
 * answers on is forwarded to its container.
 */
const PUBLISHED = [
  { service: 'web', port: 5173 },
  { service: 'api', port: 3000 },
  { service: 'minio', port: 9000 },
];

const FIXTURE = resolve(import.meta.dirname, '../fixtures/s2.mp4');
const TITLE = `Browser playback ${Date.now()}`;
const deadline = Date.now() + Number(values['timeout-sec']) * 1000;
const token = mintToken({ role: 'user', ttl: '1h' });

function step(text: string): void {
  process.stdout.write(`==> ${text}\n`);
}

function answers(port: number): Promise<boolean> {
  return new Promise((settle) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.destroy();
      settle(true);
    });
    socket.once('error', () => settle(false));
  });
}

function docker(...args: string[]): string {
  return execFileSync('docker', args, { encoding: 'utf8' }).trim();
}

function forward(port: number, service: string): Server {
  const container = docker(
    'compose',
    '-f',
    'infra/compose/docker-compose.yml',
    'ps',
    '-q',
    service
  );
  const host = docker(
    'inspect',
    '-f',
    '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}',
    container
  );
  step(`forwarding 127.0.0.1:${port} to ${service} at ${host}:${port}`);
  return createServer((client) => {
    const upstream = createConnection({ host, port });
    client.on('error', () => upstream.destroy());
    upstream.on('error', () => client.destroy());
    client.pipe(upstream).pipe(client);
  }).listen(port, '127.0.0.1');
}

interface VideoState {
  src: string;
  currentTime: number;
  paused: boolean;
  readyState: number;
  error: number | null;
}

const VIDEO_STATE = `(() => {
  const video = document.querySelector('video');
  if (video === null) return null;
  const { currentSrc: src, currentTime, paused, readyState } = video;
  return { src, currentTime, paused, readyState, error: video.error?.code ?? null };
})()`;

async function statusOf(videoId: string): Promise<string> {
  const res = await fetch(`${values.api}/v1/videos/${videoId}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const body = (await res.json()) as { status?: string };
  return body.status ?? `HTTP ${res.status}`;
}

const forwarders: Server[] = [];
for (const { service, port } of PUBLISHED) {
  if (!(await answers(port))) forwarders.push(forward(port, service));
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
  page.on('console', (message) => {
    if (message.type() === 'error') step(`browser console error: ${message.text()}`);
  });
  page.on('requestfailed', (request) => {
    step(`browser request failed: ${request.url()} ${request.failure()?.errorText ?? ''}`);
  });

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
  let video: VideoState | null = await page.evaluate(VIDEO_STATE);
  while ((video?.currentTime ?? 0) <= 1) {
    if (Date.now() > deadline) throw new Error(`the video did not play: ${JSON.stringify(video)}`);
    await new Promise((settle) => setTimeout(settle, 250));
    video = await page.evaluate(VIDEO_STATE);
  }
  step('the browser played the video past one second');
} finally {
  await browser.close();
  for (const forwarder of forwarders) forwarder.close();
}
