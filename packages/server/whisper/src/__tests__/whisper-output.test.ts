import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { parseWhisperOutput } from '../whisper-output';

const segment = (from: number, to: number, text: string) => ({
  timestamps: { from: '', to: '' },
  offsets: { from, to },
  text,
});

describe('@vp/whisper: whisper JSON output', () => {
  it('reads the detected language and one trimmed cue per non-empty segment', () => {
    const output = JSON.stringify({
      result: { language: 'en' },
      transcription: [
        segment(30, 3870, ' Hello world.'),
        segment(3870, 4000, ' '),
        segment(4000, 6400, ' Bye.'),
      ],
    });

    expect(expectOk(parseWhisperOutput(output))).toEqual({
      language: 'en',
      cues: [
        { startMs: 30, endMs: 3870, text: 'Hello world.' },
        { startMs: 4000, endMs: 6400, text: 'Bye.' },
      ],
    });
  });

  it.each(['not json', '{"result":{}}'])('fails the run on output it cannot read: %s', (output) => {
    expect(expectErr(parseWhisperOutput(output)).code).toBe(ErrorCodes.WHISPER_FAILED);
  });
});
