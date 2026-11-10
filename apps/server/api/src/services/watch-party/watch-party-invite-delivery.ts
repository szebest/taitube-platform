import {
  DEFAULT_PREFERENCES,
  type NotificationPreferences,
  type PrivacyPreferences,
  type UserPreferences,
} from '@vp/domain/settings';
import { MS_PER_HOUR } from '@vp/domain/time';

const INVITE_TTL_MS = 24 * MS_PER_HOUR;
const AFTER_SCHEDULE_MS = 6 * MS_PER_HOUR;

export interface InviteDeliveryInput {
  readonly notifications: NotificationPreferences;
  readonly subscribesToInviter: boolean;
  readonly blocksInviter: boolean;
  readonly alreadySeated: boolean;
}

export function notificationsOf(
  preferences: Pick<UserPreferences, 'notifications'> | undefined
): NotificationPreferences {
  return preferences?.notifications ?? DEFAULT_PREFERENCES.notifications;
}

export function privacyOf(
  preferences: Pick<UserPreferences, 'privacy'> | undefined
): PrivacyPreferences {
  return preferences?.privacy ?? DEFAULT_PREFERENCES.privacy;
}

/** Whether an invite reaches its invitee: their settings, a block and a seat they already hold each refuse it. */
export function acceptsPartyInvite({
  notifications,
  subscribesToInviter,
  blocksInviter,
  alreadySeated,
}: InviteDeliveryInput): boolean {
  if (alreadySeated || blocksInviter || !notifications.watchParties) return false;
  switch (notifications.watchPartyInvites) {
    case 'everyone':
      return true;
    case 'subscriptions':
      return subscribesToInviter;
    case 'nobody':
      return false;
  }
}

/** The later of a day after sending and six hours after the party was scheduled to start. */
export function inviteExpiry(now: Date, scheduledFor: Date | null): Date {
  const afterSending = now.getTime() + INVITE_TTL_MS;
  const afterStart = scheduledFor === null ? 0 : scheduledFor.getTime() + AFTER_SCHEDULE_MS;
  return new Date(Math.max(afterSending, afterStart));
}
