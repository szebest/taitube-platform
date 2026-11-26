import { expectErr, expectOk } from '@kit/testing/result';
import type { BlurRegion } from '@vp/domain';
import { decideVideoEdit } from '../decide-video-edit.rule';

const DURATION = 60_000;
const blur = (overrides: Partial<BlurRegion> = {}): BlurRegion => ({
  startMs: 1_000,
  endMs: 5_000,
  shape: 'rect',
  x: 0.1,
  y: 0.1,
  w: 0.2,
  h: 0.2,
  strength: 10,
  ...overrides,
});

describe('@vp/domain-rules: decideVideoEdit', () => {
  it.each([
    { shape: 'a trim alone', input: { trim: { startMs: 5_000, endMs: 50_000 }, blurs: [] } },
    { shape: 'a blur alone', input: { trim: null, blurs: [blur()] } },
    {
      shape: 'an ellipse at the frame edge',
      input: { trim: null, blurs: [blur({ shape: 'ellipse', x: 0.8, w: 0.2 })] },
    },
    {
      shape: 'twenty blurs',
      input: { trim: null, blurs: Array.from({ length: 20 }, () => blur()) },
    },
  ])('accepts $shape', ({ input }) => {
    expect(expectOk(decideVideoEdit(input, { durationMs: DURATION }))).toEqual(input);
  });

  it.each([
    { shape: 'nothing to do', input: { trim: null, blurs: [] }, field: 'trim' },
    {
      shape: 'a trim past the end',
      input: { trim: { startMs: 0, endMs: 61_000 }, blurs: [] },
      field: 'trim',
    },
    {
      shape: 'a trim under a second',
      input: { trim: { startMs: 0, endMs: 999 }, blurs: [] },
      field: 'trim',
    },
    {
      shape: 'twenty-one blurs',
      input: { trim: null, blurs: Array.from({ length: 21 }, () => blur()) },
      field: 'blurs',
    },
    {
      shape: 'a region past the frame',
      input: { trim: null, blurs: [blur({ x: 0.9, w: 0.2 })] },
      field: 'blurs',
    },
    { shape: 'an empty region', input: { trim: null, blurs: [blur({ h: 0 })] }, field: 'blurs' },
    {
      shape: 'a blur too short',
      input: { trim: null, blurs: [blur({ endMs: 1_200 })] },
      field: 'blurs',
    },
    {
      shape: 'a strength past the limit',
      input: { trim: null, blurs: [blur({ strength: 21 })] },
      field: 'blurs',
    },
    {
      shape: 'a fractional strength',
      input: { trim: null, blurs: [blur({ strength: 2.5 })] },
      field: 'blurs',
    },
  ])('refuses $shape', ({ input, field }) => {
    expect(expectErr(decideVideoEdit(input, { durationMs: DURATION }))).toMatchObject({ field });
  });
});
