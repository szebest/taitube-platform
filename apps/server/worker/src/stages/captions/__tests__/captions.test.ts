import { captionsChunkKey, captionsFileKey, captionsTmpPrefix } from '@vp/storage';
import { expectOk } from '@vp/testing/result';
import { createCaptionsProcessor } from '../captions';
import { captionsWorld } from './captions-harness';

describe('captions stage: the run and the merge', () => {
  it('transcribes a short source whole and publishes a ready track without touching the video', async () => {
    const world = await captionsWorld({ durationMs: 30_000 });
    const before = expectOk(await world.repositories.videos.findById(world.videoId));

    const result = expectOk(
      await createCaptionsProcessor(world.deps)(world.job({ type: 'single' }))
    );

    expect(result).toEqual({ type: 'track', outcome: 'ready', language: 'en', cues: 3 });
    const track = expectOk(await world.repositories.captions.findById(world.track.id));
    expect(track).toMatchObject({ status: 'ready', language: 'en', detectedLanguage: 'en' });
    expect(expectOk(await world.repositories.captions.cues(world.track.id))).toHaveLength(3);
    const vtt = expectOk(
      await world.storage.getObject('public', captionsFileKey(world.videoId, 'en'))
    ).toString();
    expect(vtt).toContain('00:00:10.000 --> 00:00:12.000\nat 10000');
    const after = expectOk(await world.repositories.videos.findById(world.videoId));
    expect([after?.status, after?.version]).toEqual([before?.status, before?.version]);
  });

  it('keeps the creator hint over the detected language', async () => {
    const world = await captionsWorld({ hint: 'pl', language: 'en' });

    expectOk(await createCaptionsProcessor(world.deps)(world.job({ type: 'single' })));

    expect(expectOk(await world.repositories.captions.findById(world.track.id))).toMatchObject({
      language: 'pl',
      detectedLanguage: 'en',
    });
  });

  it('disables the track of a source with no audio and succeeds', async () => {
    const world = await captionsWorld({ silent: true });

    expect(
      expectOk(await createCaptionsProcessor(world.deps)(world.job({ type: 'single' })))
    ).toEqual({
      type: 'skipped',
    });
    expect(expectOk(await world.repositories.captions.findById(world.track.id))).toMatchObject({
      status: 'disabled',
      reason: 'NO_AUDIO',
    });
  });

  it('fails the track when another track already holds the detected language', async () => {
    const world = await captionsWorld();
    expectOk(
      await world.repositories.captions.upload({
        id: '11111111-1111-7111-8111-111111111111',
        videoId: world.videoId,
        language: 'en',
        cues: [],
      })
    );

    const result = expectOk(
      await createCaptionsProcessor(world.deps)(world.job({ type: 'single' }))
    );

    expect(result).toMatchObject({ outcome: 'failed' });
    expect(expectOk(await world.repositories.captions.findById(world.track.id))).toMatchObject({
      status: 'failed',
      reason: 'LANGUAGE_TAKEN',
    });
  });

  it('steps aside when the track moved on since the run was asked for', async () => {
    const world = await captionsWorld();
    expectOk(await world.repositories.captions.delete(world.track.id));

    expect(
      expectOk(await createCaptionsProcessor(world.deps)(world.job({ type: 'single' })))
    ).toEqual({
      type: 'skipped',
    });
    expect(world.spans).toEqual([]);
  });

  it('merges the windows in media order and purges them', async () => {
    const world = await captionsWorld({ durationMs: 400_000 });
    const windows = [
      { language: 'en', cues: [{ startMs: 190_000, endMs: 191_000, text: 'two' }] },
      { language: 'en', cues: [{ startMs: 0, endMs: 1000, text: 'one' }] },
    ];
    for (const [index, window] of [windows[1], windows[0]].entries()) {
      expectOk(
        await world.storage.uploadObject({
          bucket: 'raw',
          key: captionsChunkKey(world.videoId, 'small-q5_1', world.track.version, index),
          body: JSON.stringify(window),
          contentType: 'application/json',
        })
      );
    }

    expectOk(
      await createCaptionsProcessor(world.deps)(world.job({ type: 'merge', windowCount: 2 }))
    );

    const cues = expectOk(await world.repositories.captions.cues(world.track.id));
    expect(cues.map((cue) => [cue.index, cue.text])).toEqual([
      [0, 'one'],
      [1, 'two'],
    ]);
    const left = expectOk(
      await world.storage.listObjects({ bucket: 'raw', prefix: captionsTmpPrefix(world.videoId) })
    );
    expect(left.keys).toEqual([]);
  });
});
