import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { majorityLanguage, mergeWindows, ownedCues, parseWindowTranscript } from '../merge-windows';

const cue = (startMs: number, endMs: number, text = `${startMs}`) => ({ startMs, endMs, text });

describe('@vp/whisper: merging windows', () => {
  it('keeps a cue only in the window its start falls in, across the overlap', () => {
    const first = { startMs: 0, ownsFromMs: 0, ownsUntilMs: 180_000 };
    const second = { startMs: 175_000, ownsFromMs: 180_000, ownsUntilMs: 360_000 };
    const straddling = 178_000;

    const fromFirst = ownedCues(first, [cue(170_000, 175_000), cue(straddling, 183_000)]);
    const fromSecond = ownedCues(second, [
      cue(straddling - second.startMs, 183_000 - second.startMs),
      cue(181_000 - second.startMs, 184_000 - second.startMs),
    ]);

    expect(fromFirst.map((c) => c.startMs)).toEqual([170_000, straddling]);
    expect(fromSecond.map((c) => c.startMs)).toEqual([181_000]);
  });

  it('numbers the merged cues in media order', () => {
    expect(
      mergeWindows([
        { language: 'en', cues: [cue(181_000, 184_000)] },
        { language: 'en', cues: [cue(0, 1000), cue(170_000, 175_000)] },
      ])
    ).toEqual([
      { index: 0, ...cue(0, 1000) },
      { index: 1, ...cue(170_000, 175_000) },
      { index: 2, ...cue(181_000, 184_000) },
    ]);
  });

  it.each([
    {
      windows: [
        { language: 'en', cues: [cue(0, 1000)] },
        { language: 'pl', cues: [cue(0, 5000)] },
      ],
      language: 'pl',
    },
    {
      windows: [
        { language: 'de', cues: [] },
        { language: 'en', cues: [] },
      ],
      language: 'de',
    },
    { windows: [], language: undefined },
  ])('picks $language as the language spoken longest', ({ windows, language }) => {
    expect(majorityLanguage(windows)).toBe(language);
  });

  it('reads back the file a window wrote', () => {
    const window = { language: 'en', cues: [cue(0, 1000)] };

    expect(expectOk(parseWindowTranscript(JSON.stringify(window)))).toEqual(window);
  });

  it.each(['', '{"language":1}'])('fails a merge on a window file it cannot read: %s', (text) => {
    expect(expectErr(parseWindowTranscript(text)).code).toBe(ErrorCodes.WHISPER_FAILED);
  });
});
