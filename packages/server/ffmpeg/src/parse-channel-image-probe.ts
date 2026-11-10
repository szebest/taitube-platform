import { MAX_CHANNEL_IMAGE_EDGE, MAX_CHANNEL_IMAGE_PIXELS } from '@vp/domain';
import { ErrorCodes, PermanentError } from '@vp/errors';

export interface ChannelImageProbe {
  format: 'jpeg' | 'png' | 'webp';
  width: number;
  height: number;
}

interface RawStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  nb_read_frames?: string;
  tags?: { rotate?: string | number };
  side_data_list?: { rotation?: number }[];
}

export interface RawImageProbe {
  streams?: RawStream[];
  error?: { string?: string };
}

const FORMATS: Readonly<Record<string, ChannelImageProbe['format']>> = {
  mjpeg: 'jpeg',
  png: 'png',
  webp: 'webp',
};

function rotationOf(stream: RawStream): number {
  const fromSideData = stream.side_data_list?.find((data) => typeof data.rotation === 'number');
  return fromSideData?.rotation ?? Number(stream.tags?.rotate ?? 0);
}

/**
 * The size is the one a viewer sees: a 90 degree turn in the tags swaps the sides, as the crop the
 * client drew did.
 */
export function parseChannelImageProbe(raw: RawImageProbe): ChannelImageProbe {
  if (raw.error) {
    throw new PermanentError(
      ErrorCodes.CORRUPT_CONTAINER,
      `ffprobe error: ${raw.error.string ?? 'unreadable file'}`
    );
  }
  const streams = raw.streams ?? [];
  const [stream] = streams;
  if (streams.length !== 1 || stream?.codec_type !== 'video') {
    throw new PermanentError(ErrorCodes.CORRUPT_CONTAINER, 'The file is not a single still image');
  }
  const format = FORMATS[stream.codec_name ?? ''];
  if (!format) {
    throw new PermanentError(
      ErrorCodes.UNSUPPORTED_CODEC,
      `Unsupported image codec "${stream.codec_name}"; allowed are JPEG, PNG and WebP`
    );
  }
  if (Number(stream.nb_read_frames ?? 1) !== 1) {
    throw new PermanentError(ErrorCodes.UNSUPPORTED_CODEC, 'Animated images are not supported');
  }

  const turned = Math.abs(rotationOf(stream)) % 180 === 90;
  const [width, height] = turned
    ? [stream.height ?? 0, stream.width ?? 0]
    : [stream.width ?? 0, stream.height ?? 0];
  if (
    width <= 0 ||
    height <= 0 ||
    width > MAX_CHANNEL_IMAGE_EDGE ||
    height > MAX_CHANNEL_IMAGE_EDGE ||
    width * height > MAX_CHANNEL_IMAGE_PIXELS
  ) {
    throw new PermanentError(
      ErrorCodes.CORRUPT_CONTAINER,
      `Invalid image dimensions ${width}x${height}`
    );
  }
  return { format, width, height };
}
