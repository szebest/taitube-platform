import type { CommentThread, CommentVideoSummary } from './comment';
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
    };

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
