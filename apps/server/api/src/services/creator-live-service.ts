import type { LiveStreamView, UpdateLiveStreamBody } from '@vp/api-contracts';
import type { CacheClient, LiveGatewayPort } from '@vp/core/ports';
import type { ChannelRepositoryPort, LiveStreamRepositoryPort } from '@vp/core/repositories';
import { type LiveStream, liveStreamPath } from '@vp/domain';
import {
  type ChannelNotFound,
  type LiveStreamNotFound,
  type LiveStreamNotLive,
  type ManageLiveStreamFailure,
  type ManageLiveStreamInput,
  channelNotFound,
  decideLiveStreamStop,
  decideLiveStreamUpdate,
  liveStreamNotFound,
  liveStreamNotLive,
} from '@vp/domain-rules';
import type { DatabaseUnavailable, LiveGatewayUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type Result, andThenAsync, err, isErr, map, ok } from '@vp/result';
import { type InvalidLiveStreamDetails, validateLiveStreamDetails } from '@vp/validation';
import { uuidv7 } from 'uuidv7';
import { announceChatMode } from './live-chat-hub';
import { liveChatMode } from './live-views';

export interface CreatorLiveServiceDeps {
  liveStreams: LiveStreamRepositoryPort;
  channels: ChannelRepositoryPort;
  gateway: LiveGatewayPort;
  /** Where a creator points OBS and a browser: `LIVE_RTMP_PUBLIC_URL`, `LIVE_WHIP_PUBLIC_URL`. */
  ingest: { rtmpPublicUrl: string; whipPublicUrl: string };
  /** A fresh unguessable credential: a stream key or an overlay or control token. */
  newSecret: () => string;
  cache: Pick<CacheClient, 'publish'>;
  now: () => number;
}

const MY_STREAM = 'me';

type HaltDeps = Pick<CreatorLiveServiceDeps, 'liveStreams' | 'gateway' | 'now'>;

/**
 * Marks a live stream stopping, so OBS reconnecting is refused, then drops the publisher; the live
 * worker sees the ingest end, archives and ends the stream.
 */
export async function haltBroadcast(
  deps: HaltDeps,
  stream: LiveStream
): Promise<Result<LiveStream, LiveStreamNotLive | LiveGatewayUnavailable | DatabaseUnavailable>> {
  const { streamKey } = stream;
  if (streamKey === null) return err(liveStreamNotLive(stream.id));

  const stopping = await deps.liveStreams.requestStop(stream.id, new Date(deps.now()));
  if (isErr(stopping)) return stopping;
  const stopped = stopping.value;
  if (stopped === null) return err(liveStreamNotLive(stream.id));

  return map(await deps.gateway.kick(liveStreamPath(streamKey)), () => stopped);
}

/** The creator's side of a broadcast: its credentials, its settings and the stop button. */
export class CreatorLiveService {
  constructor(private readonly deps: CreatorLiveServiceDeps) {}

  async open(
    viewer: UserContext
  ): Promise<Result<LiveStreamView, ChannelNotFound | DatabaseUnavailable>> {
    const { channels, liveStreams, newSecret } = this.deps;

    const channel = await channels.findByUserId(viewer.id);
    if (isErr(channel)) return channel;
    if (channel.value === null) return err(channelNotFound(viewer.id));

    const seed = {
      id: uuidv7(),
      streamKey: newSecret(),
      overlayToken: newSecret(),
      controlToken: newSecret(),
    };
    return map(await liveStreams.ensureIdle(channel.value.id, seed), (stream) => this.view(stream));
  }

  async current(
    viewer: UserContext
  ): Promise<Result<LiveStreamView, LiveStreamNotFound | DatabaseUnavailable>> {
    const { channels, liveStreams } = this.deps;

    const channel = await channels.findByUserId(viewer.id);
    if (isErr(channel)) return channel;
    const open = channel.value && (await liveStreams.findOpenByChannel(channel.value.id));
    if (open && isErr(open)) return open;
    return open?.value ? ok(this.view(open.value)) : err(liveStreamNotFound(MY_STREAM));
  }

  async update(
    viewer: UserContext,
    streamId: string,
    body: UpdateLiveStreamBody
  ): Promise<
    Result<LiveStreamView, ManageLiveStreamFailure | InvalidLiveStreamDetails | DatabaseUnavailable>
  > {
    const { visibility, archiveVisibility, chatSlowModeSeconds, chatSubscribersOnly, ...details } =
      body;

    const input = await this.managed(viewer, streamId);
    if (isErr(input)) return input;
    const decided = decideLiveStreamUpdate(input.value);
    if (isErr(decided)) return decided;
    const valid = validateLiveStreamDetails(details);
    if (isErr(valid)) return valid;

    const updated = await this.deps.liveStreams.update(decided.value.id, {
      ...valid.value,
      ...(visibility && { visibility }),
      ...(archiveVisibility && { archiveVisibility }),
      ...(chatSlowModeSeconds === undefined ? {} : { chatSlowModeSeconds }),
      ...(chatSubscribersOnly === undefined ? {} : { chatSubscribersOnly }),
    });
    if (isErr(updated)) return updated;
    if (updated.value === null) return err(liveStreamNotFound(streamId));

    if (chatSlowModeSeconds !== undefined || chatSubscribersOnly !== undefined) {
      await announceChatMode(this.deps.cache, updated.value);
    }
    return ok(this.view(updated.value));
  }

  async stop(
    viewer: UserContext,
    streamId: string
  ): Promise<
    Result<
      LiveStreamView,
      ManageLiveStreamFailure | LiveStreamNotLive | LiveGatewayUnavailable | DatabaseUnavailable
    >
  > {
    const input = await this.managed(viewer, streamId);
    if (isErr(input)) return input;
    const live = decideLiveStreamStop(input.value);
    if (isErr(live)) return live;
    return map(await haltBroadcast(this.deps, live.value), (stream) => this.view(stream));
  }

  /** What a manage rule decides on: the stream and the user who owns its channel. */
  private async managed(
    viewer: UserContext,
    streamId: string
  ): Promise<Result<ManageLiveStreamInput, DatabaseUnavailable>> {
    const { channels, liveStreams } = this.deps;

    return andThenAsync(await liveStreams.findById(streamId), async (stream) => {
      const channel = stream === null ? ok(null) : await channels.findById(stream.channelId);
      return map(channel, (owner) => ({
        actor: viewer,
        streamId,
        stream,
        ownerId: owner?.userId ?? null,
      }));
    });
  }

  private view(stream: LiveStream): LiveStreamView {
    const { rtmpPublicUrl, whipPublicUrl } = this.deps.ingest;
    const { streamKey, overlayToken, controlToken } = stream;
    const ingestible = streamKey !== null && overlayToken !== null && controlToken !== null;

    return {
      id: stream.id,
      status: stream.status,
      title: stream.title,
      description: stream.description,
      visibility: stream.visibility,
      archiveVisibility: stream.archiveVisibility,
      startedAt: stream.startedAt?.toISOString() ?? null,
      endedAt: stream.endedAt?.toISOString() ?? null,
      videoId: stream.videoId,
      ingest: ingestible
        ? {
            rtmpUrl: rtmpPublicUrl,
            streamKey,
            whipUrl: `${whipPublicUrl}/${streamKey}/whip`,
            overlayToken,
            controlToken,
          }
        : null,
      chat: liveChatMode(stream),
    };
  }
}
