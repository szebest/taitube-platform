import { expectOk } from '@kit/testing/result';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { failCaptionsRun } from '../captions-failure';
import { captionsWorld } from './captions-harness';

describe('captions stage: a parked run', () => {
  it('marks the track failed and leaves the video as it was', async () => {
    const world = await captionsWorld();
    const error = new PermanentError(ErrorCodes.WHISPER_MODEL_INVALID, 'model');

    expectOk(
      await failCaptionsRun(
        world.repositories,
        world.deps.metrics,
        world.job({ type: 'single' }),
        error
      )
    );

    const track = expectOk(await world.repositories.captions.findById(world.track.id));
    expect(track).toMatchObject({ status: 'failed', reason: ErrorCodes.WHISPER_MODEL_INVALID });
    const video = expectOk(await world.repositories.videos.findById(world.videoId));
    expect(video?.status).toBe('UPLOADED');
  });
});
