import { asCdnBase } from '../cdn-base';

describe('packages/env-schema: asCdnBase', () => {
  it.each([
    { raw: 'http://cdn/x///', expected: 'http://cdn/x' },
    { raw: 'http://cdn/x', expected: 'http://cdn/x' },
    { raw: 'http://cdn/x/', expected: 'http://cdn/x' },
  ])('normalises $raw to $expected', ({ raw, expected }) => {
    expect(asCdnBase(raw)).toBe(expected);
  });

  it('gives two spellings of one base the same value', () => {
    expect(asCdnBase('http://cdn/x///')).toBe(asCdnBase('http://cdn/x'));
  });
});
