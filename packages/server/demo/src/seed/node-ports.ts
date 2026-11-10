import { spawn } from 'node:child_process';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { basename } from 'node:path';
import { upsertIdentities } from '@vp/db/seed-identities';
import { mintToken } from '@vp/dev-token';
import { asThrowable } from '@vp/errors';
import { type Result, err, fromPromise, isErr, ok } from '@vp/result';
import { UploadClient } from '@vp/upload-client';
import type { DemoOptions, SeedHost } from '../types';
import type { SeedFailure } from './failure';
import { parseContractRoutes } from './openapi-routes';
import type { FetchPort, SeedPorts, UploaderPort } from './ports';

const CONTRACT_URL = new URL('../../../../universal/api-contracts/openapi.yaml', import.meta.url);
const TOKEN_TTL = '12h';

export function runProcess(
  binary: string,
  args: readonly string[]
): Promise<Result<void, SeedFailure>> {
  return new Promise((resolve) => {
    const child = spawn(binary, [...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-2000);
    });
    child.on('error', (cause) =>
      resolve(err({ kind: 'process', message: `${binary} could not start: ${cause.message}` }))
    );
    child.on('close', (code) =>
      resolve(
        code === 0
          ? ok(undefined)
          : err({ kind: 'process', message: `${binary} exited ${code}: ${stderr.trim()}` })
      )
    );
  });
}

/** `UploadClient` throws `initUpload failed (429): ...`; the status is what the retry decides on. */
export function failureFromUpload(message: string): SeedFailure {
  const status = /\((\d{3})\)/.exec(message)?.[1];
  return status
    ? { kind: 'http', method: 'POST', path: '/v1/uploads', status: Number(status), message }
    : { kind: 'invalid', message };
}

const COMPOSE_STORAGE_ALIASES: Readonly<Record<string, string>> = {
  'minio:9000': 'localhost:9000',
};

/**
 * The compose API signs URLs for `minio:9000`, which only the compose network resolves. The request goes
 * to the alias and keeps the signed `Host` header, which `fetch` forbids setting, hence `node:http`.
 */
export function aliasingFetch(aliases: Readonly<Record<string, string>>): FetchPort {
  return (url, init) => {
    const target = new URL(url);
    const reachable = aliases[target.host];
    if (!reachable) return fetch(url, init);
    const via = new URL(url);
    via.host = reachable;
    const body = init?.body;
    return new Promise((resolve, reject) => {
      const headers = { ...Object.fromEntries(new Headers(init?.headers)), host: target.host };
      const request = httpRequest(via, { method: init?.method ?? 'GET', headers }, (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          const status = response.statusCode ?? 502;
          const nullBody = status === 204 || status === 205 || status === 304;
          resolve(new Response(nullBody ? null : Buffer.concat(chunks), { status }));
        });
      });
      request.on('error', reject);
      request.end(typeof body === 'string' || body instanceof Uint8Array ? body : undefined);
    });
  };
}

export function createUploader(apiUrl: string, send: FetchPort): UploaderPort {
  return {
    async upload({ token, filePath, title, contentType }) {
      const client = new UploadClient({ apiBaseUrl: apiUrl, token });
      const uploaded = await fromPromise(
        async () => {
          const bytes = await readFile(filePath);
          const started = await client.initUpload({
            filename: basename(filePath),
            sizeBytes: bytes.byteLength,
            contentType,
            title,
            strategy: 'single',
          });
          if (!started.singleUrl) throw new Error('initUpload gave no single upload url');
          const put = await send(started.singleUrl, {
            method: 'PUT',
            headers: started.headers ?? { 'content-type': contentType },
            body: bytes,
          });
          if (!put.ok) throw new Error(`Single upload failed (${put.status}): ${put.statusText}`);
          return client.completeUpload(started.uploadId);
        },
        (cause) => failureFromUpload(asThrowable(cause).message)
      );
      return isErr(uploaded) ? uploaded : ok({ videoId: uploaded.value.videoId });
    },
  };
}

export function createNodePorts(
  options: DemoOptions,
  host: SeedHost,
  ffmpegBinary = 'ffmpeg'
): SeedPorts {
  const send = aliasingFetch(host.storageAliases ?? COMPOSE_STORAGE_ALIASES);
  return {
    fetch: send,
    files: {
      exists: async (path) => (await fromPromise(stat(path), () => undefined)).ok,
      mkdir: async (path) => {
        await mkdir(path, { recursive: true });
      },
      read: (path) => readFile(path),
    },
    clock: {
      now: () => Date.now(),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    },
    uploader: createUploader(options.apiUrl, send),
    runFfmpeg: (args) => runProcess(ffmpegBinary, args),
    async writeIdentities(rows) {
      if (!host.databaseUrl) {
        return err({ kind: 'database', message: 'no DATABASE_URL to write identities to' });
      }
      const log = {
        info: (_fields: Record<string, unknown>, message: string) => host.log(`  db: ${message}`),
        warn: (_fields: Record<string, unknown>, message: string) => host.log(`  db: ${message}`),
      };
      const written = await upsertIdentities(host.databaseUrl, rows, log);
      return isErr(written)
        ? err({ kind: 'database', message: written.error.message })
        : ok(written.value);
    },
    async contractRoutes() {
      const document = await fromPromise(
        () => readFile(CONTRACT_URL, 'utf8'),
        (cause): SeedFailure => ({
          kind: 'process',
          message: `cannot read the committed OpenAPI document: ${String(cause)}`,
        })
      );
      return isErr(document) ? document : ok(parseContractRoutes(document.value));
    },
    cdnBaseUrl: host.cdnBaseUrl ?? null,
    signToken: (sub, role) => mintToken({ sub, role, ttl: TOKEN_TTL }),
  };
}
