import { canReadNotification, canUpdateNotification, type UserContext } from '@vp/permissions';
import type { Result } from '@vp/result';
import { type AuthorizationFailure, authorize } from '../authorize';

const CAN = { read: canReadNotification, update: canUpdateNotification } as const;

export interface NotificationAccessInput {
  readonly actor: UserContext | null;
  readonly ownerId: string;
  readonly action: keyof typeof CAN;
}

export function decideNotificationAccess({
  actor,
  ownerId,
  action,
}: NotificationAccessInput): Result<UserContext, AuthorizationFailure> {
  return authorize(actor, CAN[action]({ user: actor, notification: { ownerId } }), {
    action,
    subject: 'Notification',
  });
}
