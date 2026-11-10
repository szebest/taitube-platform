import { DEFAULT_PREFERENCES, type NotificationPreferences } from '@vp/domain/settings';
import { MS_PER_HOUR } from '@vp/domain/time';
import {
  acceptsPartyInvite,
  inviteExpiry,
  notificationsOf,
  privacyOf,
} from '../watch-party-invite-delivery';

const SETTINGS = DEFAULT_PREFERENCES.notifications;
const NOW = new Date('2026-03-01T12:00:00.000Z');

interface Overrides {
  readonly notifications?: Partial<NotificationPreferences>;
  readonly subscribesToInviter?: boolean;
  readonly blocksInviter?: boolean;
  readonly alreadySeated?: boolean;
}

const delivery = ({ notifications, ...rest }: Overrides = {}) =>
  acceptsPartyInvite({
    notifications: { ...SETTINGS, ...notifications },
    subscribesToInviter: false,
    blocksInviter: false,
    alreadySeated: false,
    ...rest,
  });

describe('acceptsPartyInvite', () => {
  it.each([
    { scenario: 'the defaults', overrides: {}, accepted: true },
    {
      scenario: 'watchParties off',
      overrides: { notifications: { watchParties: false } },
      accepted: false,
    },
    {
      scenario: 'nobody',
      overrides: { notifications: { watchPartyInvites: 'nobody' } },
      accepted: false,
    },
    {
      scenario: 'subscriptions and a subscription',
      overrides: {
        notifications: { watchPartyInvites: 'subscriptions' },
        subscribesToInviter: true,
      },
      accepted: true,
    },
    {
      scenario: 'subscriptions and none',
      overrides: { notifications: { watchPartyInvites: 'subscriptions' } },
      accepted: false,
    },
    { scenario: 'a block on the inviter', overrides: { blocksInviter: true }, accepted: false },
    { scenario: 'a seat already held', overrides: { alreadySeated: true }, accepted: false },
  ] as { scenario: string; overrides: Overrides; accepted: boolean }[])(
    'answers $accepted for $scenario',
    ({ overrides, accepted }) => {
      expect(delivery(overrides)).toBe(accepted);
    }
  );
});

describe('inviteExpiry', () => {
  it.each([
    { scenario: 'a party with no schedule', scheduledFor: null, hours: 24 },
    {
      scenario: 'a party scheduled within the day',
      scheduledFor: new Date(NOW.getTime() + 2 * MS_PER_HOUR),
      hours: 24,
    },
    {
      scenario: 'a party scheduled two days out',
      scheduledFor: new Date(NOW.getTime() + 48 * MS_PER_HOUR),
      hours: 54,
    },
    {
      scenario: 'a party that should have started long ago',
      scheduledFor: new Date(NOW.getTime() - 72 * MS_PER_HOUR),
      hours: 24,
    },
  ])('ends an invite to $scenario $hours hours after now', ({ scheduledFor, hours }) => {
    expect(inviteExpiry(NOW, scheduledFor).getTime()).toBe(NOW.getTime() + hours * MS_PER_HOUR);
  });
});

describe('notificationsOf and privacyOf', () => {
  it.each([
    { saved: undefined, section: SETTINGS },
    { saved: { notifications: null }, section: SETTINGS },
    {
      saved: { notifications: { ...SETTINGS, watchParties: false } },
      section: { ...SETTINGS, watchParties: false },
    },
  ])('reads saved notification settings over the defaults', ({ saved, section }) => {
    expect(notificationsOf(saved)).toEqual(section);
  });

  it.each([
    { saved: undefined, shown: true },
    { saved: { privacy: null }, shown: true },
    { saved: { privacy: { ...DEFAULT_PREFERENCES.privacy, showInParties: false } }, shown: false },
  ])('reads saved privacy settings over the defaults', ({ saved, shown }) => {
    expect(privacyOf(saved).showInParties).toBe(shown);
  });
});
