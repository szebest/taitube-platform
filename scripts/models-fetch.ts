import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { parseArgs } from 'node:util';

const ROOT = resolve(import.meta.dirname, '..');

const { values } = parseArgs({
  options: {
    lock: { type: 'string', default: resolve(ROOT, 'apps/server/worker/assets.lock') },
    out: { type: 'string', default: resolve(ROOT, '.models') },
  },
});

const MODELS = ['CAPTIONS_MODEL', 'CAPTIONS_VAD_MODEL'] as const;

function parseLock(text: string): Map<string, string> {
  const entries = text
    .split('\n')
    .filter((line) => line.trim() !== '' && !line.startsWith('#'))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)] as const);
  return new Map(entries);
}

async function sha256Of(file: string): Promise<string | undefined> {
  const hash = createHash('sha256');
  const read = await pipeline(createReadStream(file), hash).then(
    () => true,
    () => false
  );
  return read ? hash.digest('hex') : undefined;
}

async function download(url: string, file: string): Promise<void> {
  const response = await fetch(url);
  if (!(response.ok && response.body)) {
    throw new Error(`${url} answered ${response.status}`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(file));
}

async function fetchModel(lock: Map<string, string>, key: string, out: string): Promise<void> {
  const url = lock.get(`${key}_URL`);
  const expected = lock.get(`${key}_SHA256`);
  if (!(url && expected)) throw new Error(`${key}_URL and ${key}_SHA256 are not in the lock file`);

  const name = basename(new URL(url).pathname);
  const target = resolve(out, name);
  if ((await sha256Of(target)) === expected) {
    process.stdout.write(`${name} present, sha256 verified\n`);
    return;
  }

  const partial = `${target}.part`;
  await download(url, partial);
  const actual = await sha256Of(partial);
  if (actual !== expected) {
    await rm(partial, { force: true });
    throw new Error(`${name} sha256 is ${actual}, the lock file pins ${expected}`);
  }
  await rename(partial, target);
  process.stdout.write(`${name} downloaded, sha256 verified\n`);
}

const lock = parseLock(await readFile(values.lock, 'utf8'));
await mkdir(values.out, { recursive: true });
for (const key of MODELS) {
  await fetchModel(lock, key, values.out);
}
