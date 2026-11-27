import { ok } from '@kit/result';
import { definePresets, resolveEntry } from '../presets';

const presets = definePresets({
  number: {
    compact: {
      default: { notation: 'compact' },
      pl: { maximumFractionDigits: 0 },
      'pl-PL': { useGrouping: false },
    },
  },
});

describe('@kit/intl: presets', () => {
  it.each([
    {
      chain: ['pl-PL', 'pl'],
      expected: { notation: 'compact', maximumFractionDigits: 0, useGrouping: false },
    },
    { chain: ['pl'], expected: { notation: 'compact', maximumFractionDigits: 0 } },
    { chain: ['sv-FI', 'sv'], expected: { notation: 'compact' } },
  ])('lays each locale of $chain over default, the most specific last', ({ chain, expected }) => {
    expect(resolveEntry(presets, 'number', 'compact', chain)).toEqual(ok(expected));
  });

  it('lays overrides over the preset', () => {
    expect(
      resolveEntry(presets, 'number', { preset: 'compact', maximumFractionDigits: 1 }, ['pl'])
    ).toEqual(ok({ notation: 'compact', maximumFractionDigits: 1 }));
  });

  it.each([
    { scenario: 'inline options', entry: { useGrouping: false } },
    { scenario: 'no entry', entry: undefined },
  ])('passes $scenario through as written', ({ entry }) => {
    expect(resolveEntry(presets, 'number', entry, ['en'])).toEqual(ok(entry));
  });

  it.each([
    { scenario: 'by name', entry: 'gone' },
    { scenario: 'with overrides', entry: { preset: 'gone', useGrouping: false } },
    { scenario: 'of a kind with none', entry: 'compact', kind: 'date' },
  ])('fails on an unknown preset $scenario', ({ entry, kind = 'number' }) => {
    expect(resolveEntry(presets, kind, entry, ['en'])).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'FORMAT_UNRENDERABLE' }),
    });
  });

  it('freezes the table', () => {
    expect(Object.isFrozen(presets)).toBe(true);
  });
});
