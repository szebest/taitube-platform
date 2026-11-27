import { createRegistry, provide } from '@kit/di';
import { err, ok } from '@kit/result';
import { definePresets, FormatPresets, resolveEntry } from '../presets';

const presets = definePresets({
  number: {
    compact: {
      default: { notation: 'compact' },
      pl: { notation: 'compact', maximumFractionDigits: 0 },
      'pl-PL': { notation: 'compact', maximumFractionDigits: 2 },
    },
  },
});

describe('@kit/intl: presets', () => {
  it.each([
    { chain: ['pl-PL', 'pl'], expected: { notation: 'compact', maximumFractionDigits: 2 } },
    { chain: ['pl'], expected: { notation: 'compact', maximumFractionDigits: 0 } },
    { chain: ['sv-FI', 'sv'], expected: { notation: 'compact' } },
  ])('resolves a preset name along $chain, then default', ({ chain, expected }) => {
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

  it.each([
    {
      scenario: 'the table the app provided',
      registry: createRegistry().provide(provide(FormatPresets, presets)),
      expected: ok(presets),
    },
    {
      scenario: 'MissingProvider when unprovided',
      registry: createRegistry(),
      expected: err(expect.objectContaining({ code: 'MISSING_PROVIDER', token: 'FormatPresets' })),
    },
  ])('resolves FormatPresets to $scenario', ({ registry, expected }) => {
    expect(registry.get(FormatPresets)).toEqual(expected);
  });
});
