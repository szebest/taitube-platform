import { ErrorCodes } from '@vp/errors';
import { err, ok } from '@vp/result';
import { compositeOver, formatHex, parseHex, toGamma, toLinear } from '../rgb';

const invalidColour = (field: string, value: string) =>
  err({ code: ErrorCodes.VALIDATION_FAILED, message: expect.any(String), field, value });

describe('rgb', () => {
  it.each([
    { label: 'six digits as opaque', hex: '#FF8000', rgba: { r: 1, g: 128 / 255, b: 0, alpha: 1 } },
    { label: 'lowercase digits', hex: '#ff8000', rgba: { r: 1, g: 128 / 255, b: 0, alpha: 1 } },
    {
      label: 'eight digits with alpha',
      hex: '#00000080',
      rgba: { r: 0, g: 0, b: 0, alpha: 128 / 255 },
    },
  ])('parses $label', ({ hex, rgba }) => {
    expect(parseHex(hex)).toEqual(ok(rgba));
  });

  it.each([
    { label: 'three digits', hex: '#fff' },
    { label: 'no hash', hex: 'FFFFFF' },
    { label: 'a non hex digit', hex: '#GGGGGG' },
  ])('rejects $label', ({ hex }) => {
    expect(parseHex(hex, 'accent')).toEqual(invalidColour('accent', hex));
  });

  it.each([
    {
      label: 'channels to uppercase six digits',
      rgba: { r: 1, g: 0.5, b: 0, alpha: 1 },
      hex: '#FF8000',
    },
    {
      label: 'channels outside 0 to 1 clamped',
      rgba: { r: 1.2, g: -0.1, b: 0, alpha: 1 },
      hex: '#FF0000',
    },
  ])('formats $label', ({ rgba, hex }) => {
    expect(formatHex(rgba)).toBe(hex);
  });

  it.each([
    { label: 'black', gamma: 0, linear: 0 },
    { label: 'the linear segment', gamma: 0.04, linear: 0.04 / 12.92 },
    { label: 'mid grey', gamma: 0.5, linear: 0.214041 },
    { label: 'white', gamma: 1, linear: 1 },
  ])('converts $label between gamma and linear light', ({ gamma, linear }) => {
    expect(toLinear(gamma)).toBeCloseTo(linear, 6);
    expect(toGamma(linear)).toBeCloseTo(gamma, 6);
  });

  it.each([
    { label: 'an opaque colour as itself', top: '#336699', ground: '#FFFFFF', result: '#336699' },
    {
      label: 'half black over white as grey',
      top: '#00000080',
      ground: '#FFFFFF',
      result: '#7F7F7F',
    },
    {
      label: 'a clear colour as the ground',
      top: '#FF000000',
      ground: '#14120F',
      result: '#14120F',
    },
    { label: 'a tint over a dark ground', top: '#C9A66B29', ground: '#14120F', result: '#312A1E' },
  ])('composites $label', ({ top, ground, result }) => {
    expect(compositeOver(top, ground)).toEqual(ok(result));
  });

  it.each([
    {
      label: 'a malformed foreground',
      top: 'black',
      ground: '#FFFFFF',
      field: 'foreground',
      value: 'black',
    },
    {
      label: 'a malformed background',
      top: '#000000',
      ground: '#FFF',
      field: 'background',
      value: '#FFF',
    },
    {
      label: 'over a translucent background, which has no colour of its own',
      top: '#00000080',
      ground: '#FFFFFF80',
      field: 'background',
      value: '#FFFFFF80',
    },
  ])('refuses to composite $label', ({ top, ground, field, value }) => {
    expect(compositeOver(top, ground)).toEqual(invalidColour(field, value));
  });
});
