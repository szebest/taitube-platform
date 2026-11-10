import type { CaptionKind } from './captions';
import type { ChannelCard } from './channel';
import type { ChannelImageKind } from './channel-images';
import type { Comment, CommentThread, CommentVideoSummary } from './comment';
import type { NotificationReadScope, NotificationView } from './notification';
import type { PreferenceSection } from './settings';
import type { VideoStatus } from './status-vocabulary';

type VideoProcessingChange =
  | { kind: 'status'; status: VideoStatus }
  | { kind: 'progress'; rendition: string; percent: number; overall: number };

/** What one signed-in person is told on `GET /v1/me/events`; `@vp/api-contracts` validates it. */
export type UserEvent =
  | { type: 'video.processing'; payload: { videoId: string; change: VideoProcessingChange } }
  | { type: 'preferences.updated'; payload: { sections: PreferenceSection[]; version: number } }
  | {
      type: 'notification.created';
      payload: { notification: NotificationView; unreadCount: number };
    }
  | {
      type: 'notification.read';
      payload:
        | { scope: 'ids'; ids: string[]; unreadCount: number }
        | { scope: 'all'; unreadCount: number };
    }
  | {
      type: 'comment.created';
      payload: {
        comment: {
          id: string;
          parentId: string | null;
          content: string;
          createdAt: string;
          author: { userId: string; handle: string | null; displayName: string | null };
        };
        video: CommentVideoSummary;
      };
    }
  | { type: 'comment.held'; payload: { commentId: string; videoId: string } }
  | {
      type: 'captions.ready';
      payload: { videoId: string; track: { id: string; language: string; kind: CaptionKind } };
    }
  | { type: 'captions.failed'; payload: { videoId: string; captionId: string; reason: string } }
  | { type: 'live.started'; payload: LiveStartedPayload }
  | { type: 'channel.image.ready'; payload: ChannelImageReadyPayload }
  | { type: 'channel.image.failed'; payload: ChannelImageFailedPayload }
  | { type: 'party.controls.updated'; payload: PartyControlsUpdatedPayload };

/** An avatar or banner upload became the channel's image at `version`. */
export interface ChannelImageReadyPayload {
  uploadId: string;
  channelId: string;
  kind: ChannelImageKind;
  version: number;
}

/** The job gave up on an upload; the channel keeps the image it had. */
export interface ChannelImageFailedPayload {
  uploadId: string;
  channelId: string;
  kind: ChannelImageKind;
  reason: string;
}

/** The target and scope of a personal control that changed; `roomId` is `null` for everywhere. */
interface PartyControlsUpdatedPayload {
  targetKey: string;
  roomId: string | null;
}

/** A channel the person subscribes to went live; `startedAt` is ISO 8601. */
export interface LiveStartedPayload {
  liveStreamId: string;
  videoId: string;
  title: string;
  startedAt: string;
  channel: ChannelCard;
}

export function videoStatusChanged(videoId: string, status: VideoStatus): UserEvent {
  return { type: 'video.processing', payload: { videoId, change: { kind: 'status', status } } };
}

export function preferencesUpdated(sections: PreferenceSection[], version: number): UserEvent {
  return { type: 'preferences.updated', payload: { sections, version } };
}

export function notificationCreated(
  notification: NotificationView,
  unreadCount: number
): UserEvent {
  return { type: 'notification.created', payload: { notification, unreadCount } };
}

export function notificationRead(scope: NotificationReadScope, unreadCount: number): UserEvent {
  return { type: 'notification.read', payload: { ...scope, unreadCount } };
}

export function commentCreated(thread: CommentThread, video: CommentVideoSummary): UserEvent {
  const { id, parentId, content, createdAt, author } = thread;
  return {
    type: 'comment.created',
    payload: {
      comment: {
        id,
        parentId,
        content,
        createdAt: createdAt.toISOString(),
        author: { userId: author.userId, handle: author.handle, displayName: author.displayName },
      },
      video,
    },
  };
}

/** Ids only: a held comment is for moderators, who read it through the inbox. */
export function commentHeld(comment: Pick<Comment, 'id' | 'videoId'>): UserEvent {
  return { type: 'comment.held', payload: { commentId: comment.id, videoId: comment.videoId } };
}

export function captionsReady(
  videoId: string,
  track: { id: string; language: string; kind: CaptionKind }
): UserEvent {
  return { type: 'captions.ready', payload: { videoId, track } };
}

export function captionsFailed(videoId: string, captionId: string, reason: string): UserEvent {
  return { type: 'captions.failed', payload: { videoId, captionId, reason } };
}

export function liveStarted(payload: LiveStartedPayload): UserEvent {
  return { type: 'live.started', payload };
}

export function channelImageReady(payload: ChannelImageReadyPayload): UserEvent {
  return { type: 'channel.image.ready', payload };
}

export function channelImageFailed(payload: ChannelImageFailedPayload): UserEvent {
  return { type: 'channel.image.failed', payload };
}

export function partyControlsUpdated(targetKey: string, roomId: string | null): UserEvent {
  return { type: 'party.controls.updated', payload: { targetKey, roomId } };
}
