import type { ChannelCard, Video } from '@vp/domain';
import type { EmbedSize } from './embed-size';

const THUMBNAIL = { width: 1280, height: 720 };

const IFRAME_ALLOW =
  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';

const PROVIDER_NAME = 'Taitube';

/** The oEmbed 1.0 `video` response. */
export interface OEmbedVideo {
  type: 'video';
  version: '1.0';
  title?: string;
  author_name?: string;
  author_url?: string;
  provider_name: string;
  provider_url: string;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
  html: string;
  width: number;
  height: number;
}

export interface BuildOEmbedInput {
  readonly video: Pick<Video, 'id' | 'title'>;
  readonly channel: ChannelCard | null;
  /** The web app's public origin, without a trailing slash. */
  readonly webOrigin: string;
  /** An absolute URL of the 1280x720 poster, when the video has one. */
  readonly thumbnailUrl: string | undefined;
  readonly size: EmbedSize;
}

export function buildOEmbed(input: BuildOEmbedInput): OEmbedVideo {
  const { video, channel, webOrigin, thumbnailUrl, size } = input;

  return {
    type: 'video',
    version: '1.0',
    ...(video.title ? { title: video.title } : {}),
    ...(channel
      ? { author_name: channel.displayName, author_url: `${webOrigin}/channel/${channel.id}` }
      : {}),
    provider_name: PROVIDER_NAME,
    provider_url: webOrigin,
    ...(thumbnailUrl
      ? {
          thumbnail_url: thumbnailUrl,
          thumbnail_width: THUMBNAIL.width,
          thumbnail_height: THUMBNAIL.height,
        }
      : {}),
    html: `<iframe src="${webOrigin}/embed/${video.id}" width="${size.width}" height="${size.height}" frameborder="0" allow="${IFRAME_ALLOW}" allowfullscreen></iframe>`,
    width: size.width,
    height: size.height,
  };
}
