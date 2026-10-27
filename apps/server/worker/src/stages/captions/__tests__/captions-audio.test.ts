import { ErrorCodes } from '@vp/errors';
import { CANONICAL_LADDER } from '@vp/job-contracts';

import { renditionPlaylistKey } from '@vp/storage';
import { expectErr, expectOk } from '@vp/testing/result';
import { transcribeSpan } from '../captions-audio';
import { captionsWorld } from './captions-harness';

describe('captions stage: the audio a run transcribes', () => {
  const span = { startMs: 0, durationMs: 30_000 };

  async function sourcesRead(world: Awaited<ReturnType<typeof captionsWorld>>) {
    const read: string[] = [];
    const audio = world.deps.media.audio;
    world.deps.media = {
      ...world.deps.media,
      audio: async (options) => {
        read.push(options.sourcePath);
        return audio(options);
      },
    };
    const result = await transcribeSpan(
      world.deps,
      world.job({ type: 'single' }).data,
      span,
      '/tmp',
      new AbortController().signal
    );
    return { read, result };
  }

  it('reads the raw source and records how fast whisper ran', async () => {
    const world = await captionsWorld();
    world.deps.now = (() => {
      let clock = 0;
      return () => (clock += 15_000);
    })();

    const { read, result } = await sourcesRead(world);

    expect(expectOk(result).language).toBe('en');
    expect(read[0]).toContain(world.run().data.sourceKey);
    const factor = await world.deps.metrics.registry.getSingleMetricAsString(
      'captions_realtime_factor'
    );
    expect(factor).toContain('captions_realtime_factor_sum{model="small-q5_1"} 2');
  });

  it('falls back to the smallest rendition once the raw source has expired', async () => {
    const world = await captionsWorld();
    expectOk(await world.storage.deleteObject('raw', world.run().data.sourceKey));
    expectOk(
      await world.repositories.videos.transition({
        videoId: world.videoId,
        from: 'UPLOADED',
        to: 'READY',
        eventType: 'test',
        patch: { ladder: CANONICAL_LADDER.slice(1) },
      })
    );

    const { read } = await sourcesRead(world);

    expect(read).toEqual([`${world.deps.cdn}/${renditionPlaylistKey(world.videoId, '480p', 1)}`]);
  });

  it('fails as a missing source when neither the source nor a rendition is left', async () => {
    const world = await captionsWorld();
    expectOk(await world.storage.deleteObject('raw', world.run().data.sourceKey));

    const { result } = await sourcesRead(world);

    expect(expectErr(result).code).toBe(ErrorCodes.SOURCE_MISSING);
  });
});
