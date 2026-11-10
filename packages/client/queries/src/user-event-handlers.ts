import type { QueryClient } from '@tanstack/react-query';
import type { PreferencesView, UserEvent, Video } from '@vp/api-contracts';
import { assertNever } from '@vp/result';
import { creatorCommentKeys } from './comment-queries';
import { notificationKeys, setUnreadCount } from './notification-queries';
import { videoKeys } from './video-queries';

type UserEventPayloads = { [Event in UserEvent as Event['type']]: Event['payload'] };

const PREFERENCES_KEY = ['preferences'] as const;
const LIVE_KEY = ['live'] as const;
const CHANNEL_DETAIL_KEY = ['channels', 'detail'] as const;

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

function applyNotificationChange(
  { unreadCount }: UserEventPayloads['notification.created' | 'notification.read'],
  queryClient: QueryClient
) {
  setUnreadCount(queryClient, unreadCount);
  void queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
}

function applyCommentCreated(
  _payload: UserEventPayloads['comment.created'],
  queryClient: QueryClient
) {
  void queryClient.invalidateQueries({ queryKey: creatorCommentKeys.all });
}

/** The captions a page lists and the transcript it reads come back with the track that landed. */
function applyCaptionsChange(
  { videoId }: UserEventPayloads['captions.ready' | 'captions.failed'],
  queryClient: QueryClient
) {
  void queryClient.invalidateQueries({ queryKey: videoKeys.captions(videoId) });
}

/** The Live now shelf and the channel the broadcast is on, which a page may show by id or handle. */
function applyLiveStarted(
  { channel }: UserEventPayloads['live.started'],
  queryClient: QueryClient
) {
  void queryClient.invalidateQueries({ queryKey: LIVE_KEY });
  for (const idOrHandle of [channel.id, channel.handle]) {
    void queryClient.invalidateQueries({ queryKey: [...CHANNEL_DETAIL_KEY, idOrHandle] });
  }
}

/**
 * What each event does to one tab's query cache; an event type with no entry does not compile.
 * @public
 */
/** The new image changes what a channel resource's `avatar` and `banner` address, so a cached one is stale. */
function applyChannelImageReady(
  { channelId }: UserEventPayloads['channel.image.ready'],
  queryClient: QueryClient
) {
  void queryClient.invalidateQueries({ queryKey: [...CHANNEL_DETAIL_KEY, channelId] });
}

/** A failed upload changes nothing a query holds; the studio's own upload state reads the event. */
function ignoreChannelImageFailed() {}

const userEventHandlers: UserEventHandlers = {
  'video.processing': applyVideoProcessing,
  'preferences.updated': applyPreferencesUpdated,
  'captions.ready': applyCaptionsChange,
  'captions.failed': applyCaptionsChange,
  'notification.created': applyNotificationChange,
  'notification.read': applyNotificationChange,
  'comment.created': applyCommentCreated,
  'live.started': applyLiveStarted,
  'channel.image.ready': applyChannelImageReady,
  'channel.image.failed': ignoreChannelImageFailed,
};

// Mapped rather than `UserEvent`, so `type` and `payload` stay correlated once the union grows.
export function applyUserEvent<Type extends keyof UserEventPayloads>(
  queryClient: QueryClient,
  event: { [Each in Type]: { type: Each; payload: UserEventPayloads[Each] } }[Type]
): void {
  userEventHandlers[event.type](event.payload, queryClient);
}
