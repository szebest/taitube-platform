import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { parseArgs } from 'node:util';
import type { LiveStreamView } from '@vp/api-contracts';
import { mintToken } from '../../packages/server/dev-token/src/index';

const { values } = parseArgs({
  options: {
    api: { type: 'string', default: 'http://localhost:3000' },
    minio: { type: 'string', default: 'http://localhost:9000' },
    bucket: { type: 'string', default: 'public' },
    file: { type: 'string', multiple: true, default: ['infra/compose/docker-compose.yml'] },
    'timeout-sec': { type: 'string', default: '120' },
  },
});

const deadline = Date.now() + Number(values['timeout-sec']) * 1000;
const token = mintToken({ ttl: '1h' });
const compose = values.file.flatMap((file) => ['-f', file]);

function step(text: string): void {
  process.stdout.write(`==> ${text}\n`);
}

async function api<T>(method: string, path: string, expected: number): Promise<T> {
  const res = await fetch(`${values.api}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}` },
  });
  if (res.status !== expected) {
    throw new Error(`${method} ${path} answered ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

async function object(key: string): Promise<string | null> {
  const res = await fetch(`${values.minio}/${values.bucket}/${key}`, { cache: 'no-store' });
  return res.ok ? res.text() : null;
}

async function until<T>(what: string, probe: () => Promise<T | null>): Promise<T> {
  for (;;) {
    const found = await probe();
    if (found !== null) return found;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((settle) => setTimeout(settle, 500));
  }
}

function mediaSequence(playlist: string): number {
  const line = playlist.split('\n').find((l) => l.startsWith('#EXT-X-MEDIA-SEQUENCE:'));
  return Number(line?.split(':')[1]);
}

function expectTags(name: string, playlist: string, tags: readonly string[]): void {
  const missing = tags.filter((tag) => !playlist.includes(tag));
  if (missing.length > 0) throw new Error(`${name} lacks ${missing.join(', ')}:\n${playlist}`);
}

/** ffmpeg stands in for OBS, run in the live worker: it has ffmpeg and reaches MediaMTX by name. */
function publish(streamKey: string): ChildProcess {
  return spawn(
    'docker',
    [
      'compose',
      ...compose,
      'exec',
      '-T',
      'worker-live',
      'ffmpeg',
      ...['-hide_banner', '-loglevel', 'error', '-re'],
      ...['-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30'],
      ...['-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000'],
      ...['-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-g', '60'],
      ...['-c:a', 'aac', '-t', '90'],
      ...['-f', 'flv', `rtmp://mediamtx:1935/live/${streamKey}`],
    ],
    { stdio: ['ignore', 'inherit', 'inherit'] }
  );
}

interface VideoView {
  status: string;
  visibility: string;
}

function videoOf(videoId: string): Promise<VideoView> {
  return api<VideoView>('GET', `/v1/videos/${videoId}`, 200);
}

const stream = await api<LiveStreamView>('POST', '/v1/me/live', 200);
if (stream.status !== 'IDLE' || stream.ingest === null) {
  throw new Error(`the dev user's stream ${stream.id} is ${stream.status}, not IDLE`);
}
const { streamKey } = stream.ingest;
step(`opened live stream ${stream.id}`);

const publisher = publish(streamKey);
const exited = once(publisher, 'exit');
try {
  const live = await until('the stream to go live', async () => {
    const current = await api<LiveStreamView>('GET', '/v1/me/live', 200);
    return current.status === 'LIVE' && current.videoId !== null ? current : null;
  });
  const videoId = live.videoId ?? '';
  step(`the stream is LIVE as video ${videoId}, which is ${(await videoOf(videoId)).status}`);

  const playlistKey = `live/${stream.id}/index.m3u8`;
  const first = await until('the live playlist', () => object(playlistKey));
  expectTags('the live playlist', first, ['#EXT-X-TARGETDURATION:2', '#EXT-X-PART:']);
  step(`the live playlist has 2 s segments and parts, from sequence ${mediaSequence(first)}`);

  const moved = await until('the window to slide', async () => {
    const playlist = await object(playlistKey);
    return playlist !== null && mediaSequence(playlist) > mediaSequence(first) ? playlist : null;
  });
  step(`the window slid to sequence ${mediaSequence(moved)}`);

  await api('POST', `/v1/me/live/${stream.id}/stop`, 202);
  await exited;
  step('stopped the broadcast and the publisher was dropped');

  const video = await until('the video to be READY', async () => {
    const current = await videoOf(videoId);
    if (current.status === 'FAILED') throw new Error(`video ${videoId} FAILED`);
    return current.status === 'READY' ? current : null;
  });
  if (video.visibility !== stream.archiveVisibility) {
    throw new Error(`the archive is ${video.visibility}, not ${stream.archiveVisibility}`);
  }
  const archive = await until('the archive', () => object(`live/${stream.id}/archive.m3u8`));
  expectTags('the archive', archive, ['#EXT-X-PLAYLIST-TYPE:EVENT', '#EXT-X-ENDLIST']);
  step(`the video is READY, ${video.visibility}, and its archive playlist is closed`);

  const ended = execFileSync(
    'docker',
    [
      ...['compose', ...compose, 'exec', '-T', 'postgres'],
      ...['psql', '-U', 'vp', '-d', 'vp', '-tAc'],
      `select status from live_streams where id = '${stream.id}'`,
    ],
    { encoding: 'utf8' }
  ).trim();
  if (ended !== 'ENDED') throw new Error(`live stream ${stream.id} is ${ended}, not ENDED`);
  const next = await api<LiveStreamView>('GET', '/v1/me/live', 200);
  if (next.id === stream.id || next.status !== 'IDLE' || next.ingest?.streamKey !== streamKey) {
    throw new Error(`the next stream does not carry the key on: ${JSON.stringify(next)}`);
  }
  step('the stream ENDED and the next idle stream carries the same key');
} finally {
  publisher.kill();
}
