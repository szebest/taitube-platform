import { isServerMuted, voiceGrantsOf, voiceStateOf } from '../voice-grants';

const NOW = new Date('2026-03-01T12:00:00.000Z');
const LATER = new Date(NOW.getTime() + 60_000);
const EARLIER = new Date(NOW.getTime() - 60_000);
const ROLES = [
  { id: 'r-muted', key: 'voice_muted' as const },
  { id: 'r-other', key: null },
];

describe('apps/api: voice grants', () => {
  it.each([
    {
      permissions: ['voice.join', 'voice.speak'] as const,
      expected: { canSubscribe: true, canPublish: true },
    },
    { permissions: ['voice.join'] as const, expected: { canSubscribe: true, canPublish: false } },
    { permissions: ['voice.speak'] as const, expected: { canSubscribe: false, canPublish: false } },
    { permissions: [] as const, expected: { canSubscribe: false, canPublish: false } },
  ])('grants $expected for $permissions', ({ permissions, expected }) => {
    expect(voiceGrantsOf({ permissions })).toEqual(expected);
  });

  it.each([
    {
      scenario: 'a standing mute',
      assignments: [{ roleId: 'r-muted', expiresAt: null }],
      expected: true,
    },
    {
      scenario: 'a mute still running',
      assignments: [{ roleId: 'r-muted', expiresAt: LATER }],
      expected: true,
    },
    {
      scenario: 'a mute that ran out',
      assignments: [{ roleId: 'r-muted', expiresAt: EARLIER }],
      expected: false,
    },
    {
      scenario: 'another role',
      assignments: [{ roleId: 'r-other', expiresAt: null }],
      expected: false,
    },
  ])('reads $scenario as server-muted=$expected', ({ assignments, expected }) => {
    expect(isServerMuted(ROLES, assignments, NOW)).toBe(expected);
  });

  it.each([
    { grants: { canSubscribe: true, canPublish: true }, muted: false, expected: 'live' },
    { grants: { canSubscribe: true, canPublish: false }, muted: false, expected: 'listening' },
    { grants: { canSubscribe: true, canPublish: false }, muted: true, expected: 'server_muted' },
  ])('shows $expected', ({ grants, muted, expected }) => {
    expect(voiceStateOf(grants, muted)).toBe(expected);
  });
});
