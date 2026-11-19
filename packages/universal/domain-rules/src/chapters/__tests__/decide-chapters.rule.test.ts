import { expectErr, expectOk } from '@kit/testing/result';
import { decideChapters } from '../decide-chapters.rule';

const chapters = [
  { startMs: 0, title: 'A' },
  { startMs: 20_000, title: 'B' },
  { startMs: 60_000, title: 'C' },
];

describe('@vp/domain-rules: decideChapters', () => {
  it.each([
    { name: 'the last starts before the end', durationMs: 90_000 },
    { name: 'the duration is unknown', durationMs: null },
  ])('accepts chapters when $name', ({ durationMs }) => {
    expect(expectOk(decideChapters(chapters, { durationMs }))).toEqual(chapters);
  });

  it('rejects a last chapter that starts at or after the end', () => {
    expect(expectErr(decideChapters(chapters, { durationMs: 60_000 }))).toMatchObject({
      field: 'chapters',
    });
  });

  it('keeps the shared rules', () => {
    expect(expectErr(decideChapters(chapters.slice(0, 2), { durationMs: 90_000 }))).toMatchObject({
      field: 'chapters',
    });
  });
});
