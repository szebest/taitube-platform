import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { expectErr, expectOk } from '@kit/testing/result';
import type { InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters/in-memory';
import type { VideoGeneration } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { CANONICAL_LADDER } from '@vp/job-contracts';
import { masterPlaylistKey, renditionObjectKey, renditionPlaylistKey } from '@vp/storage';
import { flowWorld, OWNER_ID } from '../../../__tests__/flow-harness';
import { fetchGenerationSource } from '../generation-source';

const VIDEO_ID = '00000000-0000-7000-8000-0000000000f2';
const LADDER = [CANONICAL_LADDER[2], CANONICAL_LADDER[1]];

const generationOf = (overrides: Partial<VideoGeneration>): VideoGeneration => ({
  videoId: VIDEO_ID,
  generation: 2,
  kind: 'edit',
  status: 'rendering',
  sourceKey: null,
  baseGeneration: 1,
  replacesGeneration: 1,
  playback: null,
  timeline: null,
  retention: null,
  needsReview: false,
  errorCode: null,
  purgeAfter: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  ...overrides,
});

describe('worker: apply-edits source', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;
  let dir: string;

  const deps = () => ({ repositories, storage, rawBucket: 'raw', publicBucket: 'public' });
  const put = (bucket: string, key: string) =>
    storage.uploadObject({ bucket, key, body: key, contentType: 'application/octet-stream' });

  beforeEach(async () => {
    ({ repositories, storage } = flowWorld());
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vp-source-'));
    expectOk(
      await repositories.videos.create({
        id: VIDEO_ID,
        ownerId: OWNER_ID,
        channelId: '00000000-0000-7000-8000-00000000c4a1',
        sourceKey: `raw/${VIDEO_ID}/source.mp4`,
        status: 'READY',
        durationMs: 60_000,
        masterPlaylistKey: masterPlaylistKey(VIDEO_ID),
        ladder: LADDER,
      })
    );
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("downloads a replacement's upload from the raw bucket", async () => {
    const sourceKey = `raw/${VIDEO_ID}/g2/source.mov`;
    expectOk(await put('raw', sourceKey));

    const source = expectOk(
      await fetchGenerationSource(deps(), generationOf({ kind: 'replacement', sourceKey }), dir)
    );

    expect(source).toEqual({ type: 'upload', path: path.join(dir, 'source.mov') });
    expect(await fs.readFile(source.path, 'utf-8')).toBe(sourceKey);
  });

  it('downloads every object of the base top rendition and hands back its list and ladder', async () => {
    expectOk(await put('public', renditionObjectKey(VIDEO_ID, '720p', 'seg_00000.ts')));
    expectOk(await put('public', renditionPlaylistKey(VIDEO_ID, '720p')));
    expectOk(await put('public', renditionPlaylistKey(VIDEO_ID, '480p')));
    const edit = { trim: { startMs: 1_000, endMs: 50_000 }, blurs: [] };
    expectOk(
      await repositories.videoGenerations.saveEdit({
        videoId: VIDEO_ID,
        generation: 2,
        baseGeneration: 1,
        replacesGeneration: 1,
        edit,
        outbox: { kind: 'apply-edits', payload: { type: 'pubsub', channel: 'x', message: '' } },
      })
    );

    const source = expectOk(await fetchGenerationSource(deps(), generationOf({}), dir));

    expect(source).toEqual({
      type: 'edit',
      path: path.join(dir, 'index.m3u8'),
      ladder: LADDER,
      edits: edit,
    });
    expect((await fs.readdir(dir)).sort()).toEqual(['index.m3u8', 'seg_00000.ts']);
  });

  it.each([
    {
      shape: 'an upload that never landed',
      generation: generationOf({ kind: 'replacement', sourceKey: 'raw/missing' }),
    },
    { shape: 'an edit with no list', generation: generationOf({}) },
    {
      shape: 'a base that is not playing and kept no playback',
      generation: generationOf({ baseGeneration: 5 }),
    },
  ])('reports $shape as a missing source', async ({ generation }) => {
    expect(expectErr(await fetchGenerationSource(deps(), generation, dir)).code).toBe(
      ErrorCodes.SOURCE_MISSING
    );
  });
});
