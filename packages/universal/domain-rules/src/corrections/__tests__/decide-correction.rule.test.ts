import { expectErr, expectOk } from '@kit/testing/result';
import { ErrorCodes } from '@vp/errors';
import { decideCorrection, decideCorrectionFields } from '../decide-correction.rule';

const context = { videoId: 'v1', durationMs: 120_000, existing: 0 };
const input = { startMs: 10_000, endMs: 15_000, text: 'The price is 5 dollars' };

describe('@vp/domain-rules: decideCorrection', () => {
  it('accepts a correction and cleans its text', () => {
    expect(expectOk(decideCorrection({ ...input, text: '  hi \n' }, context))).toEqual({
      ...input,
      text: 'hi',
    });
  });

  it.each([
    { name: 'under two seconds', patch: { endMs: 11_000 } },
    { name: 'over thirty seconds', patch: { endMs: 41_000 } },
    { name: 'before the start', patch: { startMs: -1 } },
    { name: 'past the end of the video', patch: { startMs: 118_000, endMs: 121_000 } },
  ])('rejects a range $name', ({ patch }) => {
    expect(expectErr(decideCorrection({ ...input, ...patch }, context))).toMatchObject({
      field: 'range',
    });
  });

  it.each([
    { name: 'blank', text: '   ' },
    { name: 'over 200 characters', text: 'a'.repeat(201) },
  ])('rejects text that is $name', ({ text }) => {
    expect(expectErr(decideCorrection({ ...input, text }, context))).toMatchObject({
      field: 'text',
    });
  });

  it('accepts any range inside an unknown duration', () => {
    expect(expectOk(decideCorrection(input, { ...context, durationMs: null }))).toEqual(input);
  });

  it('decides the fields of an edit without counting the limit', () => {
    expect(
      expectOk(decideCorrectionFields({ ...input, text: ' fixed ' }, { durationMs: 120_000 }))
    ).toEqual({ ...input, text: 'fixed' });
  });

  it('refuses the eleventh correction', () => {
    expect(expectErr(decideCorrection(input, { ...context, existing: 10 }))).toMatchObject({
      code: ErrorCodes.CORRECTION_LIMIT,
    });
  });
});
