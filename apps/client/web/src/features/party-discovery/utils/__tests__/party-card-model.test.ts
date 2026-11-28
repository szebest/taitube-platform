import type { WatchPartyCardView } from '@vp/api-contracts';
import type { PartyDiscoveryFilters } from '@vp/queries';
import { isFull, matchesFilters, pillOf, progressOf } from '../party-card-model';

const NOW = Date.parse('2026-03-01T12:00:00Z');

function card(overrides: Partial<WatchPartyCardView> = {}): WatchPartyCardView {
  return {
    id: '0190c3a0-5e1d-7000-8000-00000000e001',
    name: 'Movie night',
    owner: { memberKey: 'user:0190c3a0-5e1d-7000-8000-00000000e002', name: 'Ana', avatarUrl: null },
    channel: null,
    hasPassword: false,
    allowGuests: true,
    capacity: null,
    effectiveCapacity: 200,
    language: 'en',
    accent: null,
    scheduledFor: null,
    phase: 'lobby',
    status: 'open',
    currentVideo: {
      id: 'v',
      title: 'Heat',
      durationMs: 100_000,
      thumbnailUrl: null,
      categoryId: 'c',
    },
    queueLength: 1,
    presentCount: 5,
    roster: { faces: [], others: 5, discord: 0, guests: 0, total: 5 },
    playback: { itemId: 'i', phase: 'playing', positionMs: 10_000, rate: 1, anchorAt: NOW },
    serverNow: NOW,
    createdAt: new Date(NOW).toISOString(),
    ...overrides,
  };
}

const ALL: PartyDiscoveryFilters = {
  status: 'all',
  access: 'any',
  size: 'any',
  space: false,
  followed: false,
  creator: false,
  kind: 'any',
  sort: 'members',
};

describe('apps/client/web: party card model', () => {
  it.each([
    { scenario: 'a playing room', room: { phase: 'playing' }, pill: 'now' },
    { scenario: 'a paused room', room: { phase: 'paused' }, pill: 'now' },
    { scenario: 'a lobby', room: { phase: 'lobby' }, pill: 'lobby' },
    { scenario: 'a finished room', room: { phase: 'finished' }, pill: 'finished' },
    {
      scenario: 'a lobby scheduled ahead',
      room: { phase: 'lobby', scheduledFor: new Date(NOW + 60_000).toISOString() },
      pill: 'scheduled',
    },
    {
      scenario: 'a lobby whose time has come',
      room: { phase: 'lobby', scheduledFor: new Date(NOW - 60_000).toISOString() },
      pill: 'lobby',
    },
  ] as const)('shows $scenario as $pill', ({ room, pill }) => {
    expect(pillOf(card(room), NOW).kind).toBe(pill);
  });

  it('moves the bar on from the clock snapshot with the server offset', () => {
    expect(progressOf(card(), NOW + 5_000, 0)).toBeCloseTo(0.15);
    expect(progressOf(card(), NOW, 10_000)).toBeCloseTo(0.2);
    expect(
      progressOf(card({ playback: { ...card().playback, phase: 'paused' } }), NOW + 90_000, 0)
    ).toBeCloseTo(0.1);
    expect(progressOf(card({ currentVideo: null }), NOW, 0)).toBeNull();
  });

  it.each([
    { present: 199, full: false },
    { present: 200, full: true },
  ])('says $present of 200 is full: $full', ({ present, full }) => {
    expect(isFull(card({ presentCount: present }))).toBe(full);
  });

  it.each([
    { scenario: 'no filters', filters: {}, matches: true },
    { scenario: 'a text search', filters: { q: 'movie' }, matches: false },
    { scenario: 'followed', filters: { followed: true }, matches: false },
    { scenario: 'status lobby', filters: { status: 'lobby' }, matches: true },
    { scenario: 'status now', filters: { status: 'now' }, matches: false },
    { scenario: 'the same category', filters: { category: 'c' }, matches: true },
    { scenario: 'another category', filters: { category: 'x' }, matches: false },
    { scenario: 'language pl', filters: { language: 'pl' }, matches: false },
    { scenario: 'password access', filters: { access: 'password' }, matches: false },
    { scenario: 'open access', filters: { access: 'open' }, matches: true },
    { scenario: 'size small', filters: { size: 'small' }, matches: true },
    { scenario: 'size large', filters: { size: 'large' }, matches: false },
    { scenario: 'creator', filters: { creator: true }, matches: false },
    { scenario: 'a playlist', filters: { kind: 'playlist' }, matches: false },
    { scenario: 'one video', filters: { kind: 'single' }, matches: true },
  ] as const)('matches a pushed room for $scenario: $matches', ({ filters, matches }) => {
    expect(matchesFilters(card(), { ...ALL, ...filters }, NOW)).toBe(matches);
  });

  it('leaves a full room out of a view that wants a seat', () => {
    expect(matchesFilters(card({ presentCount: 200 }), { ...ALL, space: true }, NOW)).toBe(false);
  });
});
