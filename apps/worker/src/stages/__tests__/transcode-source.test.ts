import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { InMemoryStorageClient } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import { createLogger } from '@vp/observability';
import { expectErr, expectOk } from '@vp/testing/result';
import { resolveTranscodeSource } from '../transcode-source';

const SOURCE_KEY = 'raw/018f0000-0000-7000-8000-000000000001/source.mp4';
const log = createLogger({ service: 'test', level: 'silent' });

describe('apps/worker/stages: transcode input source', () => {
  let storage: InMemoryStorageClient;
  let tmpDir: string;

  const resolve = (streaming: boolean) =>
    resolveTranscodeSource({
      storage,
      rawBucket: 'raw',
      sourceKey: SOURCE_KEY,
      tmpDir,
      rendition: '720p',
      streaming,
      log,
    });

  beforeEach(() => {
    storage = new InMemoryStorageClient();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-transcode-source-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const store = () =>
    storage.uploadObject({
      bucket: 'raw',
      key: SOURCE_KEY,
      body: Buffer.from('media'),
      contentType: 'video/mp4',
    });

  it('hands FFmpeg a presigned URL in streaming mode, without touching the disk', async () => {
    expect(expectOk(await resolve(true))).toContain(SOURCE_KEY);
    expect(fs.readdirSync(tmpDir)).toEqual([]);
  });

  it('downloads the object to the job temp dir otherwise', async () => {
    await store();

    const local = expectOk(await resolve(false));

    expect(local).toBe(path.join(tmpDir, 'source.mp4'));
    expect(fs.readFileSync(local, 'utf8')).toBe('media');
  });

  it('reports a missing object as SOURCE_MISSING naming the stage', async () => {
    expect(expectErr(await resolve(false))).toMatchObject({
      code: ErrorCodes.SOURCE_MISSING,
      stage: 'transcode-720p',
    });
  });
});
