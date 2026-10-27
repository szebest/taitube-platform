import { ErrorCodes, RETRY_CLASS } from '@vp/errors';
import { classifyWhisperFailure } from '../classify-whisper-failure';

describe('@vp/whisper: failure classification', () => {
  it.each([
    { exit: 137, signal: null, stderr: '', code: ErrorCodes.WHISPER_KILLED, retry: 'transient' },
    {
      exit: null,
      signal: 'SIGKILL',
      stderr: '',
      code: ErrorCodes.WHISPER_KILLED,
      retry: 'transient',
    },
    {
      exit: 3,
      signal: null,
      stderr: 'error: failed to initialize whisper context',
      code: ErrorCodes.WHISPER_MODEL_INVALID,
      retry: 'permanent',
    },
    {
      exit: 0,
      signal: null,
      stderr: "error: failed to read audio file 'a.wav'",
      code: ErrorCodes.WHISPER_INPUT_REJECTED,
      retry: 'permanent',
    },
    {
      exit: 134,
      signal: null,
      stderr: 'abort',
      code: ErrorCodes.WHISPER_FAILED,
      retry: 'transient',
    },
  ])('reads exit $exit / $signal as $code ($retry)', ({ exit, signal, stderr, code, retry }) => {
    const failure = classifyWhisperFailure(exit, signal, stderr);

    expect(failure).toMatchObject({ code, stage: 'captions' });
    expect(RETRY_CLASS[failure.code]).toBe(retry);
  });
});
