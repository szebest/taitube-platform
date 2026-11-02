import { type QuarantineEntry, quarantineFindings, unquarantined, vitestExclude } from '../entries';

const entry = (overrides: Partial<QuarantineEntry> = {}): Partial<QuarantineEntry> => ({
  spec: 'apps/client/web/e2e/shorts.test.ts',
  owner: 'szebest',
  reason: 'arrow keys lost before hydration',
  expires: '2026-11-30',
  ticket: '137',
  ...overrides,
});

describe('quarantine entries', () => {
  it.each([
    { scenario: 'a complete, current entry', entries: [entry()], expected: [] },
    {
      scenario: 'an entry with no owner',
      entries: [entry({ owner: '' })],
      expected: ['apps/client/web/e2e/shorts.test.ts: no owner'],
    },
    {
      scenario: 'an expired entry',
      entries: [entry({ expires: '2026-11-01' })],
      expected: ['apps/client/web/e2e/shorts.test.ts: expired on 2026-11-01'],
    },
    {
      scenario: 'six entries',
      entries: Array.from({ length: 6 }, () => entry()),
      expected: ['6 entries, over the 5 the quarantine holds'],
    },
  ])('finds $scenario', ({ entries, expected }) => {
    expect(quarantineFindings(entries, '2026-11-02')).toEqual(expected);
  });

  it('names a failing spec no entry quarantines', () => {
    expect(
      unquarantined(
        ['apps/client/web/e2e/shorts.test.ts', 'apps/client/web/e2e/watch.test.ts'],
        [entry() as QuarantineEntry]
      )
    ).toEqual(['apps/client/web/e2e/watch.test.ts']);
  });

  it.each([
    ['apps/client/web/src/a/__tests__/b.dom.test.tsx', '**/src/a/__tests__/b.dom.test.tsx'],
    ['packages/client/ui/src/__tests__/c.test.ts', '**/src/__tests__/c.test.ts'],
    ['tests/in-process/d.test.ts', '**/d.test.ts'],
  ])('excludes %s from its vitest project as %s', (spec, glob) => {
    expect(vitestExclude(spec)).toBe(glob);
  });
});
