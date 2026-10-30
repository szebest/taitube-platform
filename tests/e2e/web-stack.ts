import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import * as http from 'node:http';
import * as path from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { mintToken } from '../../packages/server/dev-token/src/index';
import { type Logger, createLogger } from '../../packages/server/logger/src/index';
import { SEEDED } from '../../packages/server/testing/src/index';
import type { Stack } from '../playwright/stack';
import { HOSTILE_CHANNEL_NAMES, HOSTILE_TEXT } from '../playwright/xss-payloads';
import { setupInProcessEnv } from './in-process-env';

const FIXTURE = path.resolve(import.meta.dirname, '../fixtures/s2.mp4');
const READY_DEADLINE_MS = 120_000;
const POLL_MS = 250;

type Visibility = 'public' | 'private';

type StartedUpload = { videoId: string; uploadId: string; singleUrl: string };

const port = (value: string | undefined) => (value === undefined ? undefined : Number(value));

function readArgs() {
  const { values } = parseArgs({
    options: {
      'stack-port': { type: 'string' },
      'api-port': { type: 'string' },
      's3-port': { type: 'string' },
      origin: { type: 'string' },
      'api-url': { type: 'string' },
    },
  });
  const stackPort = port(values['stack-port']);
  const origin = values.origin;
  if (!(stackPort && origin)) throw new Error('--stack-port and --origin are required');
  return {
    stackPort,
    apiPort: port(values['api-port']),
    s3Port: port(values['s3-port']),
    origin,
    apiUrl: values['api-url'],
  };
}

const jsonAuth = (token: string) => ({
  authorization: `Bearer ${token}`,
  'content-type': 'application/json',
});

async function call(url: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(
      `${init.method ?? 'GET'} ${url} answered ${response.status}: ${await response.text()}`
    );
  }
  return response;
}

async function startUpload(apiUrl: string, token: string, title: string, visibility: Visibility) {
  const { size } = await stat(FIXTURE);
  const started = await call(`${apiUrl}/v1/uploads`, {
    method: 'POST',
    headers: jsonAuth(token),
    body: JSON.stringify({
      filename: path.basename(FIXTURE),
      sizeBytes: size,
      contentType: 'video/mp4',
      strategy: 'single',
      title,
      visibility,
    }),
  });
  return (await started.json()) as StartedUpload;
}

async function seedReadyVideo(apiUrl: string, token: string, title: string) {
  const upload = await startUpload(apiUrl, token, title, 'public');
  await call(upload.singleUrl, {
    method: 'PUT',
    headers: { 'content-type': 'video/mp4' },
    body: await readFile(FIXTURE),
  });
  await call(`${apiUrl}/v1/uploads/${upload.uploadId}/complete`, {
    method: 'POST',
    headers: jsonAuth(token),
    body: '{}',
  });

  const deadline = Date.now() + READY_DEADLINE_MS;
  while (Date.now() < deadline) {
    const response = await call(`${apiUrl}/v1/videos/${upload.videoId}`, {
      headers: jsonAuth(token),
    });
    const { status, version } = (await response.json()) as { status: string; version: number };
    if (status === 'READY') return { id: upload.videoId, title, version };
    if (status === 'FAILED') throw new Error(`seeded video ${upload.videoId} failed to process`);
    await wait(POLL_MS);
  }
  throw new Error(`seeded video ${upload.videoId} was not READY within ${READY_DEADLINE_MS} ms`);
}

async function main(log: Logger): Promise<void> {
  const args = readArgs();
  const env = args.apiUrl
    ? undefined
    : await setupInProcessEnv(log, {
        apiPort: args.apiPort,
        s3Port: args.s3Port,
        corsOrigins: [args.origin],
      });
  const apiUrl = args.apiUrl ?? env?.apiUrl;
  if (!apiUrl) throw new Error('no API to run against');

  const run = randomUUID().slice(0, 8);
  const personas = {
    creator: mintToken({ sub: SEEDED.userId }),
    viewer: mintToken({ sub: SEEDED.otherUserId }),
  };
  const draftTitle = `E2E private draft ${run}`;
  const [watchable, canvas, draft] = await Promise.all([
    seedReadyVideo(apiUrl, personas.creator, `E2E seeded video ${run}`),
    seedReadyVideo(apiUrl, personas.creator, `${HOSTILE_TEXT} ${run}`),
    startUpload(apiUrl, personas.creator, draftTitle, 'private'),
  ]);
  await call(`${apiUrl}/v1/videos/${canvas.id}`, {
    method: 'PATCH',
    headers: jsonAuth(personas.creator),
    body: JSON.stringify({ description: HOSTILE_TEXT, version: canvas.version }),
  });
  await Promise.all([
    call(`${apiUrl}/v1/me/channel`, {
      method: 'PATCH',
      headers: jsonAuth(personas.creator),
      body: JSON.stringify({ displayName: HOSTILE_CHANNEL_NAMES.creator }),
    }),
    call(`${apiUrl}/v1/me/channel`, {
      method: 'PATCH',
      headers: jsonAuth(personas.viewer),
      body: JSON.stringify({ displayName: HOSTILE_CHANNEL_NAMES.viewer }),
    }),
  ]);
  await call(`${apiUrl}/v1/videos/${canvas.id}/comments`, {
    method: 'POST',
    headers: jsonAuth(personas.viewer),
    body: JSON.stringify({ content: HOSTILE_TEXT }),
  });
  const state = JSON.stringify({
    apiUrl,
    personas,
    videos: { watchable, canvas, draft: { id: draft.videoId, title: draftTitle } },
  } satisfies Stack);

  const control = http.createServer((_request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(state);
  });
  control.listen(args.stackPort, '127.0.0.1');
  log.info({ apiUrl, stackPort: args.stackPort, run }, 'web e2e stack ready');

  const shutdown = async () => {
    control.close();
    await env?.teardown();
    process.exit(0);
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

const log = createLogger({ service: 'web-e2e-stack', level: 'info', format: 'pretty' });

main(log).catch((err) => {
  log.error({ err }, 'web e2e stack failed to start');
  process.exit(1);
});
