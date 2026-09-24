export interface HeaderMapping {
  contentType: string;
  cacheControl: string;
}

const HEADER_MAPPINGS: Record<string, HeaderMapping> = {
  '.m3u8': {
    contentType: 'application/vnd.apple.mpegurl',
    cacheControl: 'public, max-age=60',
  },
  '.ts': {
    contentType: 'video/MP2T',
    cacheControl: 'public, max-age=31536000, immutable',
  },
  '.jpg': {
    contentType: 'image/jpeg',
    cacheControl: 'public, max-age=31536000, immutable',
  },
  '.jpeg': {
    contentType: 'image/jpeg',
    cacheControl: 'public, max-age=31536000, immutable',
  },
  '.vtt': {
    contentType: 'text/vtt',
    cacheControl: 'public, max-age=31536000, immutable',
  },
  '.json': {
    contentType: 'application/json',
    cacheControl: 'public, max-age=60',
  },
  '.mp4': {
    contentType: 'video/mp4',
    cacheControl: 'private, no-cache',
  },
};

/**
 * Returns the authoritative Content-Type and Cache-Control headers for a given file path or key (SDD §7).
 */
export function getHeaderMapping(filenameOrKey: string): HeaderMapping {
  const basename = filenameOrKey.slice(filenameOrKey.lastIndexOf('/') + 1);
  const dot = basename.lastIndexOf('.');
  const ext = dot > 0 ? basename.slice(dot).toLowerCase() : '';
  return (
    HEADER_MAPPINGS[ext] ?? {
      contentType: 'application/octet-stream',
      cacheControl: 'no-cache',
    }
  );
}
