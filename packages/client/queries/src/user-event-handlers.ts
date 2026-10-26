import type { QueryClient } from '@tanstack/react-query';
import type { PreferencesView, UserEvent, Video } from '@vp/api-contracts';
import { assertNever } from '@vp/result';

import { videoKeys } from './video-queries';

type UserEventPayloads = { [Event in UserEvent as Event['type']]: Event['payload'] };

const PREFERENCES_KEY = ['preferences'] as const;
const NOTIFICATIONS_KEY = ['notifications'] as const;
const UNREAD_COUNT_KEY = [...NOTIFICATIONS_KEY, 'unread-count'] as const;

type UserEventHandlers = {
  [Type in keyof UserEventPayloads]: (
    payload: UserEventPayloads[Type],
    queryClient: QueryClient
  ) => void;
};

function patchVideo(queryClient: QueryClient, videoId: string, patch: (video: Video) => Video) {
  queryClient.setQueryData<Video>(videoKeys.detail(videoId), (video) => video && patch(video));
}

function applyVideoProcessing(
  { videoId, change }: UserEventPayloads['video.processing'],
  queryClient: QueryClient
) {
  switch (change.kind) {
    case 'status':
      patchVideo(queryClient, videoId, (video) => ({ ...video, status: change.status }));
      void queryClient.invalidateQueries({ queryKey: videoKeys.detail(videoId) });
      void queryClient.invalidateQueries({ queryKey: videoKeys.mine() });
      return;
    case 'progress':
      patchVideo(queryClient, videoId, (video) => ({
        ...video,
        progress: {
          overall: change.overall,
          byRendition: { ...video.progress.byRendition, [change.rendition]: change.percent },
        },
      }));
      return;
    default:
      assertNever(change, 'VideoProcessingChange');
  }
}

function applyPreferencesUpdated(
  { version }: UserEventPayloads['preferences.updated'],
  queryClient: QueryClient
) {
  const cached = queryClient.getQueryData<PreferencesView>(PREFERENCES_KEY);
  if (cached && cached.version >= version) return;

  void queryClient.invalidateQueries({ queryKey: PREFERENCES_KEY });
}

export function setUnreadCount(queryClient: QueryClient, unreadCount: number) {
  queryClient.setQueryData<{ unreadCount: number }>(UNREAD_COUNT_KEY, { unreadCount });
}

function applyNotificationCreated(
  { unreadCount }: UserEventPayloads['notification.created'],
  queryClient: QueryClient
) {
  setUnreadCount(queryClient, unreadCount);
  void queryClient.invalidateQueries({ queryKey: [...NOTIFICATIONS_KEY, 'list'] });
}

function applyNotificationRead(
  { unreadCount }: UserEventPayloads['notification.read'],
  queryClient: QueryClient
) {
  setUnreadCount(queryClient, unreadCount);
  void queryClient.invalidateQueries({ queryKey: [...NOTIFICATIONS_KEY, 'list'] });
}

/**
 * What each event does to one tab's query cache; an event type with no entry does not compile.
 * @public
 */
export const userEventHandlers: UserEventHandlers = {
  'video.processing': applyVideoProcessing,
  'preferences.updated': applyPreferencesUpdated,
  'notification.created': applyNotificationCreated,
  'notification.read': applyNotificationRead,
};

// Mapped rather than `UserEvent`, so `type` and `payload` stay correlated once the union grows.
export function applyUserEvent<Type extends keyof UserEventPayloads>(
  queryClient: QueryClient,
  event: { [Each in Type]: { type: Each; payload: UserEventPayloads[Each] } }[Type]
): void {
  userEventHandlers[event.type](event.payload, queryClient);
}
