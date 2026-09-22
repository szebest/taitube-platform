export * from './keys';
export * from './mime';
export * from './multipart';

export const ContentTypes = {
  HLS_PLAYLIST: 'application/vnd.apple.mpegurl',
  MPEG_TS: 'video/MP2T',
  JPEG: 'image/jpeg',
  WEBVTT: 'text/vtt',
  JSON: 'application/json',
  MP4: 'video/mp4',
} as const;

export const CacheControl = {
  PLAYLIST: 'public, max-age=60',
  IMMUTABLE_SEGMENT: 'public, max-age=31536000, immutable',
} as const;
