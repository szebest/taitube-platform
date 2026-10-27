import { expectErr, expectOk } from '@vp/testing/result';
import { parseWebVtt, toWebVtt } from '../webvtt';

const CUES = [
  { startMs: 30, endMs: 3870, text: 'Hello world.' },
  { startMs: 3870, endMs: 66_400, text: 'The quick brown fox\njumps over the lazy dog.' },
];

describe('@vp/whisper: WebVTT', () => {
  it('writes cues as a WebVTT track that reads back to the same cues', () => {
    const track = toWebVtt(CUES);

    expect(track).toBe(
      'WEBVTT\n\n00:00:00.030 --> 00:00:03.870\nHello world.\n\n00:00:03.870 --> 00:01:06.400\nThe quick brown fox\njumps over the lazy dog.\n'
    );
    expect(expectOk(parseWebVtt(track))).toEqual(CUES);
  });

  it.each([
    { file: 'SRT\n\n00:00:01.000 --> 00:00:02.000\nHi\n', line: 1 },
    { file: 'WEBVTT\n\n00:00:01.000 --> 00:00:0x\nHi\n', line: 3 },
    { file: 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi\n\nstray text\n', line: 6 },
    { file: '\n\nWEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi\n\nNOTE x\n\nbad\n', line: 10 },
    { file: 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi\n\n99999:00:00.000 --> 99999:00:05.000\nFar\n', line: 6 },
  ])('names line $line of a malformed file', ({ file, line }) => {
    expect(expectErr(parseWebVtt(file)).line).toBe(line);
  });
});
