import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ENTRYPOINT = resolve(import.meta.dirname, '../models-fetch.ts');
const MODEL = Buffer.from('small model bytes');
const VAD = Buffer.from('vad model bytes');
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

function run(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((done) => {
    execFile(
      process.execPath,
      ['--import', 'tsx', ENTRYPOINT, ...args],
      { env: { PATH: process.env.PATH } },
      (error, stdout, stderr) => done({ code: error ? Number(error.code ?? 1) : 0, stdout, stderr })
    );
  });
}

describe('scripts: models-fetch', () => {
  let server: Server;
  let base: string;
  let requests: string[];
  const dirs: string[] = [];

  beforeAll(async () => {
    server = createServer((request, response) => {
      requests.push(request.url ?? '');
      response.end(request.url === '/vad.bin' ? VAD : MODEL);
    });
    await new Promise<void>((listening) => server.listen(0, '127.0.0.1', listening));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  beforeEach(() => {
    requests = [];
  });

  afterAll(() => {
    server.close();
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  });

  function workspace(modelSha = sha256(MODEL)) {
    const dir = mkdtempSync(join(tmpdir(), 'models-fetch-'));
    dirs.push(dir);
    const lock = join(dir, 'assets.lock');
    writeFileSync(
      lock,
      [
        'WHISPER_CPP_TAG=v0',
        `CAPTIONS_MODEL_URL=${base}/model.bin`,
        `CAPTIONS_MODEL_SHA256=${modelSha}`,
        `CAPTIONS_VAD_MODEL_URL=${base}/vad.bin`,
        `CAPTIONS_VAD_MODEL_SHA256=${sha256(VAD)}`,
        '',
      ].join('\n')
    );
    return { lock, out: join(dir, '.models') };
  }

  it('downloads both models, and fetches nothing on a second run', async () => {
    const { lock, out } = workspace();

    const first = await run(['--lock', lock, '--out', out]);
    const second = await run(['--lock', lock, '--out', out]);

    expect(first.code).toBe(0);
    expect(readFileSync(join(out, 'model.bin'))).toEqual(MODEL);
    expect(readFileSync(join(out, 'vad.bin'))).toEqual(VAD);
    expect(second.stdout).toBe(
      'model.bin present, sha256 verified\nvad.bin present, sha256 verified\n'
    );
    expect(requests).toEqual(['/model.bin', '/vad.bin']);
  });

  it('replaces a file whose checksum is wrong', async () => {
    const { lock, out } = workspace();
    mkdirSync(out);
    writeFileSync(join(out, 'model.bin'), 'truncated');

    const result = await run(['--lock', lock, '--out', out]);

    expect(result.code).toBe(0);
    expect(readFileSync(join(out, 'model.bin'))).toEqual(MODEL);
  });

  it('fails on a checksum mismatch and leaves no file behind', async () => {
    const { lock, out } = workspace('0'.repeat(64));

    const result = await run(['--lock', lock, '--out', out]);

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain(`model.bin sha256 is ${sha256(MODEL)}`);
    expect(readdirSync(out)).toEqual([]);
  });
});
