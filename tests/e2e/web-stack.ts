import { readFile, stat } from 'node:fs/promises';
import * as http from 'node:http';
import * as path from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { HOSTILE_TEXT } from '../../apps/web/e2e/security/xss-payloads';
import { mintToken } from '../../packages/server/dev-token/src/index';
import { type Logger, createLogger } from '../../packages/server/logger/src/index';
import { SEEDED } from '../../packages/server/testing/src/index';
import { setupInProcessEnv } from './in-process-env';

const FIXTURE = path.resolve(import.meta.dirname, '../fixtures/s2.mp4');
const READY_DEADLINE_MS = 120_000;
const POLL_MS = 250;

interface SeededVideo {
  id: string;
  title: string;
}

interface ReadyVideo extends SeededVideo {
  version: number;
}

function readArgs() {
  const { values } = parseArgs({
    options: {
      'stack-port': { type: 'string' },
      'api-port': { type: 'string', default: '0' },
      's3-port': { type: 'string', default: '0' },
      'web-origin': { type: 'string' },
      'api-url': { type: 'string' },
    },
  });
  const stackPort = values['stack-port'];
  const webOrigin = values['web-origin'];
  if (!(stackPort && webOrigin)) throw new Error('--stack-port and --web-origin are required');
  return {
    stackPort: Number(stackPort),
    apiPort: Number(values['api-port']),
    s3Port: Number(values['s3-port']),
    webOrigin,
    apiUrl: values['api-url'],
  };
}

async function call(url: string, init: RequestInit): Promise<Response> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(
      `${init.method ?? 'GET'} ${url} answered ${response.status}: ${await response.text()}`
    );
  }
  return response;
}

async function waitUntilReady(apiUrl: string, token: string, videoId: string): Promise<number> {
  const deadline = Date.now() + READY_DEADLINE_MS;
  while (Date.now() < deadline) {
    const response = await call(`${apiUrl}/v1/videos/${videoId}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const { status, version } = (await response.json()) as { status: string; version: number };
    if (status === 'READY') return version;
    if (status === 'FAILED') throw new Error(`seeded video ${videoId} failed to process`);
    await wait(POLL_MS);
  }
  throw new Error(`seeded video ${videoId} was not READY within ${READY_DEADLINE_MS} ms`);
}

const jsonAuth = (token: string) => ({
  authorization: `Bearer ${token}`,
  'content-type': 'application/json',
});

async function startUpload(apiUrl: string, token: string, title: string, visibility: string) {
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
  return (await started.json()) as { videoId: string; uploadId: string; singleUrl: string };
}

async function seedDraft(apiUrl: string, token: string, title: string): Promise<SeededVideo> {
  const upload = await startUpload(apiUrl, token, title, 'private');
  return { id: upload.videoId, title };
}

async function seedReadyVideo(apiUrl: string, token: string, title: string): Promise<ReadyVideo> {
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
  const version = await waitUntilReady(apiUrl, token, upload.videoId);
  return { id: upload.videoId, title, version };
}

async function describeVideo(
  apiUrl: string,
  token: string,
  video: ReadyVideo,
  description: string
) {
  await call(`${apiUrl}/v1/videos/${video.id}`, {
    method: 'PATCH',
    headers: jsonAuth(token),
    body: JSON.stringify({ description, version: video.version }),
  });
}

async function main(log: Logger): Promise<void> {
  const args = readArgs();
  const env = args.apiUrl
    ? undefined
    : await setupInProcessEnv(log, {
        apiPort: args.apiPort,
        s3Port: args.s3Port,
        corsOrigins: [args.webOrigin],
      });
  const apiUrl = args.apiUrl ?? env?.apiUrl;
  if (!apiUrl) throw new Error('no API to run against');

  const personas = {
    creator: mintToken({ sub: SEEDED.userId }),
    viewer: mintToken({ sub: SEEDED.otherUserId }),
  };
  const [watchable, canvas, draft] = await Promise.all([
    seedReadyVideo(apiUrl, personas.creator, 'E2E seeded video'),
    seedReadyVideo(apiUrl, personas.creator, HOSTILE_TEXT),
    seedDraft(apiUrl, personas.creator, 'E2E private draft'),
  ]);
  await describeVideo(apiUrl, personas.creator, canvas, HOSTILE_TEXT);
  const state = JSON.stringify({ apiUrl, personas, videos: { watchable, canvas, draft } });

  const control = http.createServer((_request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(state);
  });
  control.listen(args.stackPort, '127.0.0.1');
  log.info({ apiUrl, stackPort: args.stackPort }, 'web e2e stack ready');

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
