import type { ChannelRepositoryPort, LiveStreamRepositoryPort } from '@vp/core/repositories';
import { type LiveStream, streamKeyFromPath } from '@vp/domain';
import {
  type LiveGatewayCall,
  type LiveIngestRefused,
  decideLiveGatewayCall,
  liveIngestRefused,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import { announceLiveOutbox, liveOutbox, subscribersOutbox } from '@vp/job-contracts';
import { type Result, err, isErr, ok } from '@vp/result';
import { liveMasterKey, livePrefix } from '@vp/storage';
import { uuidv7 } from 'uuidv7';

export interface LiveIngestServiceDeps {
  liveStreams: LiveStreamRepositoryPort;
  channels: ChannelRepositoryPort;
  /** `LIVE_HOOK_SECRET`; absent refuses every call. */
  hookSecret: string | undefined;
  now: () => number;
}

export interface LiveIngestCall {
  presentedSecret: string | undefined;
  call: LiveGatewayCall;
  requestId?: string;
}

type LiveIngestFailure = LiveIngestRefused | DatabaseUnavailable;

/** Answers the ingest gateway's auth hook, and takes a stream live when its key first publishes. */
export class LiveIngestService {
  constructor(private readonly deps: LiveIngestServiceDeps) {}

  async authorize(input: LiveIngestCall): Promise<Result<void, LiveIngestFailure>> {
    const { liveStreams, hookSecret } = this.deps;
    const key = streamKeyFromPath(input.call.path);
    const found = key === null ? ok(null) : await liveStreams.findByKey(key);
    if (isErr(found)) return found;

    const verdict = decideLiveGatewayCall({
      configuredSecret: hookSecret,
      presentedSecret: input.presentedSecret,
      call: input.call,
      stream: found.value,
    });
    if (isErr(verdict)) return verdict;
    return verdict.value.type === 'go-live'
      ? this.goLive(verdict.value.stream, input.requestId)
      : ok();
  }

  /**
   * Two publishers racing on one key both reach here; the compare-and-set lets one through and the
   * other is admitted only if the stream did go live, as a reconnect would be.
   */
  private async goLive(
    stream: LiveStream,
    requestId: string | undefined
  ): Promise<Result<void, LiveIngestFailure>> {
    const { liveStreams, channels, now } = this.deps;

    const channel = await channels.findById(stream.channelId);
    if (isErr(channel)) return channel;
    if (channel.value === null) return err(liveIngestRefused('unknown-key'));

    const videoId = uuidv7();
    const started = await liveStreams.goLive({
      streamId: stream.id,
      startedAt: new Date(now()),
      video: {
        id: videoId,
        ownerId: channel.value.userId,
        title: stream.title || channel.value.displayName,
        description: stream.description,
        visibility: stream.visibility,
        sourceKey: livePrefix(stream.id),
        masterPlaylistKey: liveMasterKey(stream.id),
      },
      outbox: [
        liveOutbox({ liveStreamId: stream.id, videoId, requestId }),
        ...(stream.visibility === 'public'
          ? [
              subscribersOutbox({ kind: 'live', videoId, requestId }),
              announceLiveOutbox({ liveStreamId: stream.id, requestId }),
            ]
          : []),
      ],
    });
    if (isErr(started)) return started;
    if (started.value !== null) return ok();

    const current = await liveStreams.findById(stream.id);
    if (isErr(current)) return current;
    return current.value?.status === 'LIVE' ? ok() : err(liveIngestRefused('not-idle'));
  }
}
