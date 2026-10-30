import { ErrorCodes, PermanentError, TransientError } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import { failCaptionsRun } from '../captions-failure';
import { captionsWorld } from './captions-harness';

describe('captions stage: a run that ran out of attempts', () => {
  it.each([
    {
      error: new TransientError(ErrorCodes.WHISPER_KILLED, 'killed'),
      attemptsMade: 3,
      status: 'failed',
    },
    {
      error: new PermanentError(ErrorCodes.WHISPER_MODEL_INVALID, 'model'),
      attemptsMade: 1,
      status: 'failed',
    },
    {
      error: new TransientError(ErrorCodes.WHISPER_KILLED, 'killed'),
      attemptsMade: 1,
      status: 'pending',
    },
  ])(
    'leaves the track $status after $error.code on attempt $attemptsMade',
    async ({ error, attemptsMade, status }) => {
      const world = await captionsWorld();
      const job = { ...world.job({ type: 'single' }), attemptsMade, opts: { attempts: 3 } };

      expectOk(await failCaptionsRun(world.repositories, world.deps.metrics, job, error));

      const track = expectOk(await world.repositories.captions.findById(world.track.id));
      expect(track?.status).toBe(status);
      const video = expectOk(await world.repositories.videos.findById(world.videoId));
      expect(video?.status).toBe('UPLOADED');
    }
  );
});
