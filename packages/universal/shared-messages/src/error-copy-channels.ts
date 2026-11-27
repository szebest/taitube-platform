import { type ErrorCode, ErrorCodes } from '@vp/errors';
import type { SharedArgumentFreeKey } from './catalogue';

export const CHANNEL_ERROR_COPY = {
  [ErrorCodes.CHANNEL_MEMBERSHIP_REQUIRED]: 'errors.channelMembershipRequired',
  [ErrorCodes.CHANNEL_LIMIT_REACHED]: 'errors.channelLimitReached',
  [ErrorCodes.CHANNEL_NOT_OWNED]: 'errors.channelNotOwned',
  [ErrorCodes.CHANNEL_INVITE_NOT_FOUND]: 'errors.channelInviteNotFound',
  [ErrorCodes.CHANNEL_INVITE_NOT_PENDING]: 'errors.channelInviteNotPending',
  [ErrorCodes.CHANNEL_INVITE_ALREADY_PENDING]: 'errors.channelInviteAlreadyPending',
  [ErrorCodes.CHANNEL_MEMBER_EXISTS]: 'errors.channelMemberExists',
  [ErrorCodes.CHANNEL_MEMBER_NOT_FOUND]: 'errors.channelMemberNotFound',
  [ErrorCodes.CHANNEL_OWNER_IMMUTABLE]: 'errors.channelOwnerImmutable',
} as const satisfies Partial<Record<ErrorCode, SharedArgumentFreeKey>>;
