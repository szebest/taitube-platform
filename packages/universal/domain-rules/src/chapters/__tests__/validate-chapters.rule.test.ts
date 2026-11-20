import { expectErr, expectOk } from '@kit/testing/result';
import { ErrorCodes } from '@vp/errors';
import { validateChapters } from '../validate-chapters.rule';

const intro = { startMs: 0, title: 'Intro' };
const middle = { startMs: 20_000, title: 'Middle' };
const end = { startMs: 60_000, title: 'End' };

describe('@vp/domain-rules: validateChapters', () => {
  it.each([
    { name: 'three chapters', chapters: [intro, middle, end], expected: [intro, middle, end] },
    {
      name: 'chapters out of order',
      chapters: [end, intro, middle],
      expected: [intro, middle, end],
    },
    {
      name: 'padded titles',
      chapters: [{ ...intro, title: ' Intro ' }, middle, end],
      expected: [intro, middle, end],
    },
    { name: 'no chapters, which clears them', chapters: [], expected: [] },
  ])('accepts $name', ({ chapters, expected }) => {
    expect(expectOk(validateChapters(chapters))).toEqual(expected);
  });

  it.each([
    { name: 'two chapters', chapters: [intro, middle] },
    { name: 'no chapter at zero', chapters: [{ ...intro, startMs: 1_000 }, middle, end] },
    {
      name: 'chapters under ten seconds apart',
      chapters: [intro, { startMs: 9_999, title: 'x' }, end],
    },
    { name: 'a blank title', chapters: [intro, { ...middle, title: '  ' }, end] },
    {
      name: 'a title over sixty characters',
      chapters: [intro, { ...middle, title: 'a'.repeat(61) }, end],
    },
    { name: 'a fractional start', chapters: [intro, { ...middle, startMs: 20_000.5 }, end] },
    { name: 'a negative start', chapters: [{ ...intro, startMs: -5 }, middle, end] },
  ])('rejects $name', ({ chapters }) => {
    expect(expectErr(validateChapters(chapters))).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'chapters',
      minGapMs: 10_000,
    });
  });
});
