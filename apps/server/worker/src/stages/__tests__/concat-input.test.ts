import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { InMemoryStorageClient } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import { createLogger } from '@vp/logger';
import { chunkKey, chunkPrefix } from '@vp/storage';
import { expectOk } from '@vp/testing/result';
import { purgeChunks, writeConcatList } from '../concat-input';

const videoId = '0197a000-0000-7000-8000-000000000001';
const logger = createLogger({ format: 'json', service: 'concat-input-spec', level: 'silent' });

describe('apps/server/worker/stages: concat input', () => {
  let storage: InMemoryStorageClient;
  let tmpDir: string;
  const params = (chunkCount: number | undefined) => ({
    storage,
    rawBucket: 'raw',
    tmpDir,
    videoId,
    generation: 1,
    rendition: '720p',
    chunkCount,
  });

  beforeEach(async () => {
    storage = new InMemoryStorageClient();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vp-concat-input-'));
    for (const index of [0, 1]) {
      expectOk(
        await storage.uploadObject({
          bucket: 'raw',
          key: chunkKey(videoId, 1, '720p', index),
          body: `chunk ${index}`,
          contentType: 'video/mp4',
        })
      );
    }
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('lists the downloaded chunks in order', async () => {
    const listPath = expectOk(await writeConcatList(params(2)));

    const lines = (await fs.readFile(listPath ?? '', 'utf-8')).split('\n');
    expect(lines.map((line) => path.basename(line))).toEqual(["chunk_0.mp4'", "chunk_1.mp4'"]);
    expect(await fs.readFile(path.join(tmpDir, 'chunk_1.mp4'), 'utf-8')).toBe('chunk 1');
  });

  it('has no list for a rendition that was not chunked', async () => {
    expect(expectOk(await writeConcatList(params(undefined)))).toBeUndefined();
  });

  it('names the missing chunk', async () => {
    const result = await writeConcatList(params(3));

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: ErrorCodes.SOURCE_MISSING }),
    });
  });

  it('purges the rendition chunks and leaves the other renditions', async () => {
    expectOk(
      await storage.uploadObject({
        bucket: 'raw',
        key: chunkKey(videoId, 1, '480p', 0),
        body: 'other',
        contentType: 'video/mp4',
      })
    );

    await purgeChunks({ ...params(2), log: logger });

    const left = expectOk(
      await storage.listObjects({ bucket: 'raw', prefix: `tmp/chunks/${videoId}/` })
    );
    expect(left.keys).toEqual([chunkKey(videoId, 1, '480p', 0)]);
    expect(chunkPrefix(videoId, 1, '720p')).toBe(`tmp/chunks/${videoId}/g1/720p/`);
  });
});
