import type { VideoStatus, VideoVisibility } from './status-vocabulary';

export const NOTIFICATION_KINDS = [
  'upload',
  'live',
  'reply',
  'mention',
  'comment',
  'processing',
  'heart',
  'party_invite',
  'party_starting',
  'team_invite',
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const NOTIFICATION_LEVELS = ['all', 'highlights', 'none'] as const;
export type NotificationLevel = (typeof NOTIFICATION_LEVELS)[number];

export const NOTIFICATION_FILTERS = ['all', 'subscriptions', 'mentions'] as const;
export type NotificationFilter = (typeof NOTIFICATION_FILTERS)[number];

const FILTER_KINDS = {
  all: NOTIFICATION_KINDS,
  subscriptions: ['upload', 'live'],
  mentions: ['reply', 'mention'],
} as const satisfies Record<NotificationFilter, readonly NotificationKind[]>;

export function kindsOfFilter(filter: NotificationFilter): readonly NotificationKind[] {
  return FILTER_KINDS[filter];
}

export const NOTIFICATION_GROUP_WINDOW_MS = 60 * 60 * 1000;
export const NOTIFICATION_RETENTION_DAYS = 90;
export const NOTIFICATION_FANOUT_BATCH = 500;
export const NOTIFICATION_EXCERPT_LENGTH = 140;

const BLOCKED_BY_LEVEL: Record<NotificationLevel, readonly NotificationKind[]> = {
  all: [],
  highlights: ['live'],
  none: NOTIFICATION_KINDS,
};

/** What a subscriber's level lets through: `highlights` is uploads only, no live. */
export function levelAllows(level: NotificationLevel, kind: NotificationKind): boolean {
  return !BLOCKED_BY_LEVEL[level].includes(kind);
}

/** The account switch that gates a kind, in `preferences.notifications`; `null` is always delivered. */
export const KIND_SWITCH = {
  upload: 'subscriptionUploads',
  live: 'subscriptionUploads',
  reply: 'repliesAndMentions',
  mention: 'repliesAndMentions',
  comment: 'repliesAndMentions',
  processing: 'processingFinished',
  heart: 'repliesAndMentions',
  party_invite: 'watchParties',
  party_starting: 'watchParties',
  team_invite: null,
} as const satisfies Record<NotificationKind, string | null>;

interface NotifiableVideo {
  ownerId: string;
  visibility: VideoVisibility;
  status: VideoStatus;
  deletedAt?: Date | null;
}

/**
 * Whether `userId` may be told about the video at all: its owner while it exists, anyone else
 * only while it is public and ready, so a notification never reveals a private or unlisted video.
 */
export function mayHearAbout(video: NotifiableVideo, userId: string): boolean {
  if (video.deletedAt) return false;
  if (video.ownerId === userId) return true;
  return video.visibility === 'public' && video.status === 'READY';
}

export interface NotificationActor {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
}

/** The invite a `party_invite` carries, frozen when it is sent: the row opens the room with `inviteId`. */
interface NotificationParty {
  roomId: string;
  name: string;
  videoTitle: string | null;
  scheduledFor: string | null;
  inviteId: string;
  expiresAt: string;
  watching: { names: string[]; count: number };
}

interface NotificationFields {
  count: number;
  actor: NotificationActor | null;
  videoTitle: string | null;
  excerpt: string | null;
  outcome: 'ready' | 'failed' | null;
  /** Set on `team_invite`: the invite the notification opens. */
  inviteId?: string;
}

/** Written when the notification is created, so listing and pushing it need no join. */
export interface NotificationPayload extends NotificationFields {
  /** Absent on a row written before watch parties; `null` on every kind but the party ones. */
  party?: NotificationParty | null;
}

interface NotificationViewPayload extends NotificationFields {
  party: NotificationParty | null;
}

export interface Notification {
  id: string;
  userId: string;
  kind: NotificationKind;
  actorChannelId: string | null;
  videoId: string | null;
  commentId: string | null;
  watchPartyId: string | null;
  groupKey: string | null;
  payload: NotificationPayload;
  readAt: Date | null;
  createdAt: Date;
}

export interface NewNotificationInput {
  userId: string;
  kind: NotificationKind;
  actorChannelId: string | null;
  videoId: string | null;
  commentId: string | null;
  /** The room a party notification points at; its row goes with the room. */
  watchPartyId?: string | null;
  groupKey: string | null;
  payload: Omit<NotificationPayload, 'count'>;
}

/** What tells one event of a group from another: the video and comment, and for an invite the invite. */
export function sameNotificationSubject(
  held: {
    videoId: string | null;
    commentId: string | null;
    payload: Pick<NotificationPayload, 'party'>;
  },
  input: Pick<NewNotificationInput, 'videoId' | 'commentId'> & {
    payload: Pick<NotificationPayload, 'party'>;
  }
): boolean {
  return (
    held.videoId === input.videoId &&
    held.commentId === input.commentId &&
    (held.payload.party?.inviteId ?? null) === (input.payload.party?.inviteId ?? null)
  );
}

/**
 * What an unread row becomes when another event of its group arrives: the newest actor and
 * subject, one more in the count, back on top. `null` when it is the same subject again, so a
 * retried job never counts twice.
 */
export function foldNotification(
  existing: Notification,
  input: NewNotificationInput,
  now: Date
): Notification | null {
  if (sameNotificationSubject(existing, input)) return null;

  return {
    ...existing,
    actorChannelId: input.actorChannelId,
    videoId: input.videoId,
    commentId: input.commentId,
    watchPartyId: input.watchPartyId ?? null,
    payload: { ...input.payload, count: existing.payload.count + 1 },
    createdAt: now,
  };
}

/** The notification as `GET /v1/me/notifications` and `notification.created` carry it. */
export interface NotificationView {
  id: string;
  kind: NotificationKind;
  actorChannelId: string | null;
  videoId: string | null;
  commentId: string | null;
  payload: NotificationViewPayload;
  read: boolean;
  createdAt: string;
}

export function toNotificationView(notification: Notification): NotificationView {
  const { id, kind, actorChannelId, videoId, commentId, payload, readAt, createdAt } = notification;
  return {
    id,
    kind,
    actorChannelId,
    videoId,
    commentId,
    payload: { ...payload, party: payload.party ?? null },
    read: readAt !== null,
    createdAt: createdAt.toISOString(),
  };
}

export type NotificationReadScope = { scope: 'ids'; ids: string[] } | { scope: 'all' };

const MENTION_PATTERN = /(?<![\w.@-])@([a-zA-Z0-9_.-]{3,30})/g;
const MAX_MENTIONS = 10;

/** `@handle` tokens in comment text, with a trailing sentence dot tried both ways. */
export function mentionedHandles(content: string): string[] {
  const handles = new Set<string>();
  for (const [, handle] of content.matchAll(MENTION_PATTERN)) {
    if (!handle) continue;
    handles.add(handle);
    const trimmed = handle.replace(/[.-]+$/, '');
    if (trimmed.length >= 3) handles.add(trimmed);
  }
  return [...handles].slice(0, MAX_MENTIONS);
}
