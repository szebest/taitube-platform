import { ErrorCodes, type Failure } from '@vp/errors';

export type OEmbedUrlUnsupported = Failure<
  typeof ErrorCodes.OEMBED_URL_UNSUPPORTED,
  { url: string }
>;

export type OEmbedFormatUnsupported = Failure<
  typeof ErrorCodes.OEMBED_FORMAT_UNSUPPORTED,
  { format: string }
>;

export function oembedUrlUnsupported(url: string): OEmbedUrlUnsupported {
  return {
    code: ErrorCodes.OEMBED_URL_UNSUPPORTED,
    message: 'The url is not a video page of this site',
    url,
  };
}

export function oembedFormatUnsupported(format: string): OEmbedFormatUnsupported {
  return {
    code: ErrorCodes.OEMBED_FORMAT_UNSUPPORTED,
    message: `The ${format} format is not supported; use json`,
    format,
  };
}
