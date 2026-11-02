import { join } from 'node:path';
import {
  excludedBy,
  type QuarantineEntry,
  quarantineFindings,
  unquarantined,
  vitestExclude,
} from '../entries';

const REPO = join(import.meta.dirname, '../../..');

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
      scenario: 'a spec whose path holds glob characters',
      entries: [entry({ spec: 'apps/client/web/src/routes/__tests__/sitemap[.]xml.test.ts' })],
      expected: [
        'apps/client/web/src/routes/__tests__/sitemap[.]xml.test.ts: its path holds glob characters, so no exclude names it alone',
      ],
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

  it("excludes a spec by its absolute path, never another package's spec with the same tail", () => {
    const [contracts = '', events = ''] = [
      'packages/universal/api-contracts/src/__tests__/channels.test.ts',
      'packages/server/events/src/__tests__/channels.test.ts',
    ];

    expect(vitestExclude(contracts)).toBe(join(REPO, contracts));
    expect(excludedBy(vitestExclude(contracts), [contracts, events])).toEqual([contracts]);
    expect(excludedBy('**/src/__tests__/channels.test.ts', [contracts, events])).toEqual([
      contracts,
      events,
    ]);
  });
});
