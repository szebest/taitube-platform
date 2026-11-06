import { captionsChunkKey } from '@vp/storage';
import { expectOk } from '@vp/testing/result';
import { parseWindowTranscript } from '@vp/whisper';
import { createCaptionsChunkProcessor } from '../captions-chunk';
import { captionsWorld } from './captions-harness';

describe('captions stage: one window', () => {
  it('reads its lead-in and tail and keeps only the cues that start in its own span', async () => {
    const world = await captionsWorld({ durationMs: 400_000 });
    const plan = { type: 'window', index: 1, windowCount: 3 } as const;

    expect(expectOk(await createCaptionsChunkProcessor(world.deps)(world.job(plan)))).toEqual({
      type: 'window',
      index: 1,
      cues: 18,
    });
    expect(world.spans).toEqual([{ startMs: 175_000, durationMs: 190_000 }]);
    const written = expectOk(
      await world.storage.getObject(
        'raw',
        captionsChunkKey(world.videoId, 'small-q5_1', world.track.version, 1)
      )
    );
    const cues = expectOk(parseWindowTranscript(written.toString())).cues;
    expect([cues[0]?.startMs, cues.at(-1)?.startMs]).toEqual([180_000, 350_000]);
  });

  it('does a replayed window no second time', async () => {
    const world = await captionsWorld({ durationMs: 400_000 });
    const process = createCaptionsChunkProcessor(world.deps);
    const job = world.job({ type: 'window', index: 0, windowCount: 3 });

    expectOk(await process(job));
    expect(expectOk(await process(job))).toEqual({ type: 'skipped' });
    expect(world.spans).toHaveLength(1);
  });

  it('disables the track when the window finds no audio', async () => {
    const world = await captionsWorld({ durationMs: 400_000, silent: true });

    expectOk(
      await createCaptionsChunkProcessor(world.deps)(
        world.job({ type: 'window', index: 0, windowCount: 3 })
      )
    );

    expect(expectOk(await world.repositories.captions.findById(world.track.id))?.status).toBe(
      'disabled'
    );
  });
});
