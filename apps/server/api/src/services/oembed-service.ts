import type { OEmbedQuery } from '@vp/api-contracts';
import type { ChannelRepositoryPort, VideoRepository } from '@vp/core/repositories';
import { toChannelCard } from '@vp/domain';
import {
  buildOEmbed,
  decideEmbedFormat,
  decideEmbedTarget,
  decideOEmbedVideo,
  fitEmbedSize,
  type OEmbedFormatUnsupported,
  type OEmbedUrlUnsupported,
  type OEmbedVideo,
  type VideoNotFound,
} from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import type { DatabaseUnavailable } from '@vp/errors';
import { andThen, andThenAsync, map, type Result } from '@vp/result';
import { cdnUrl } from './video-views';

export interface OEmbedServiceDeps {
  videos: VideoRepository;
  channels: ChannelRepositoryPort;
  cdn: CdnBase;
  webUrl: string;
}

type OEmbedFailure =
  | OEmbedFormatUnsupported
  | OEmbedUrlUnsupported
  | VideoNotFound
  | DatabaseUnavailable;

/** The oEmbed 1.0 provider: a public, ready video behind a watch page of this site, as an iframe. */
export class OEmbedService {
  constructor(private readonly deps: OEmbedServiceDeps) {}

  async embed(query: OEmbedQuery): Promise<Result<OEmbedVideo, OEmbedFailure>> {
    const { videos, channels, cdn, webUrl } = this.deps;

    const accepted = andThen(decideEmbedFormat(query.format), () =>
      decideEmbedTarget({ url: query.url, webUrl })
    );

    return andThenAsync(
      accepted,
      async ({ videoId }): Promise<Result<OEmbedVideo, OEmbedFailure>> =>
        andThenAsync(await videos.findById(videoId), async (found) =>
          andThenAsync(decideOEmbedVideo(found, videoId), async (video) =>
            map(await channels.findByUserId(video.ownerId), (channel) =>
              buildOEmbed({
                video,
                channel: channel && toChannelCard(channel),
                webOrigin: webUrl,
                thumbnailUrl: video.posterKey ? cdnUrl(cdn, video.posterKey) : undefined,
                size: fitEmbedSize(query),
              })
            )
          )
        )
    );
  }
}
