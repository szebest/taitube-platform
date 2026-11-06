import type { LiveChatMessageView, LiveChatMode, LiveStreamPublicView } from '@vp/api-contracts';
import { type Channel, type LiveChatMessage, type LiveStream, toChannelCard } from '@vp/domain';
import type { CdnBase } from '@vp/env-schema';
import { liveMasterKey } from '@vp/storage';
import { cdnUrl } from './video-views';

export function liveChatMode(stream: LiveStream): LiveChatMode {
  return {
    slowModeSeconds: stream.chatSlowModeSeconds,
    subscribersOnly: stream.chatSubscribersOnly,
  };
}

interface LiveViewInput {
  stream: LiveStream;
  channel: Channel;
  viewers: number;
  /** Whether the recording finished packaging, which is when an ended stream plays again. */
  recordingReady: boolean;
}

/** The master playlist is the live one while it runs and the archive once the video is ready. */
export function toLiveStreamView(input: LiveViewInput, cdn: CdnBase): LiveStreamPublicView {
  const { stream, channel, viewers, recordingReady } = input;
  const live = stream.status === 'LIVE';
  return {
    id: stream.id,
    status: stream.status,
    title: stream.title || channel.displayName,
    description: stream.description,
    channel: toChannelCard(channel),
    videoId: stream.videoId,
    startedAt: stream.startedAt?.toISOString() ?? null,
    endedAt: stream.endedAt?.toISOString() ?? null,
    viewers: live ? viewers : 0,
    playbackUrl: live || recordingReady ? cdnUrl(cdn, liveMasterKey(stream.id)) : null,
    chat: liveChatMode(stream),
  };
}

export function toLiveChatMessageView(message: LiveChatMessage): LiveChatMessageView {
  return {
    id: message.id,
    author: message.author,
    message: message.message,
    offsetMs: message.offsetMs,
    createdAt: message.createdAt.toISOString(),
  };
}
