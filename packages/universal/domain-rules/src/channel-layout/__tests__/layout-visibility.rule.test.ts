import type { LayoutVisibility, ViewerAudience } from '@vp/domain';
import { type LayoutViewer, isShownTo } from '../layout-visibility.rule';

const NOW = new Date('2026-12-01T12:00:00Z');
const visibility = (overrides: Partial<LayoutVisibility>): LayoutVisibility => ({
  audience: 'everyone',
  from: null,
  to: null,
  locales: [],
  ...overrides,
});
const viewer = (audience: ViewerAudience, locales: string[] = ['en']): LayoutViewer => ({
  audience,
  now: NOW,
  locales,
});

describe('@vp/domain-rules: isShownTo', () => {
  it.each([
    { audience: 'everyone', guest: true, member: true, subscriber: true },
    { audience: 'visitors', guest: true, member: true, subscriber: false },
    { audience: 'subscribers', guest: false, member: false, subscriber: true },
    { audience: 'signed_in', guest: false, member: true, subscriber: true },
  ] as const)('shows $audience as guest $guest, member $member, subscriber $subscriber', (row) => {
    const shown = (['guest', 'member', 'subscriber'] as const).map((who) =>
      isShownTo(visibility({ audience: row.audience }), viewer(who))
    );

    expect(shown).toEqual([row.guest, row.member, row.subscriber]);
  });

  it.each([
    { scenario: 'before its window', from: '2026-12-02T00:00:00Z', to: null, shown: false },
    {
      scenario: 'inside its window',
      from: '2026-12-01T00:00:00Z',
      to: '2026-12-02T00:00:00Z',
      shown: true,
    },
    { scenario: 'after its window', from: null, to: '2026-12-01T12:00:00Z', shown: false },
  ])('judges a section $scenario', ({ from, to, shown }) => {
    expect(isShownTo(visibility({ from, to }), viewer('guest'))).toBe(shown);
  });

  it.each([
    { scenario: 'every locale when none is named', locales: [], chain: ['pl', 'en'], shown: true },
    {
      scenario: 'a locale in the chain',
      locales: ['pl'],
      chain: ['pl-PL', 'pl', 'en'],
      shown: true,
    },
    { scenario: 'a locale outside the chain', locales: ['de'], chain: ['pl', 'en'], shown: false },
    {
      scenario: 'not the fallback of another locale',
      locales: ['en'],
      chain: ['pl', 'en'],
      shown: false,
    },
  ])('shows $scenario', ({ locales, chain, shown }) => {
    expect(isShownTo(visibility({ locales }), viewer('guest', chain))).toBe(shown);
  });
});
