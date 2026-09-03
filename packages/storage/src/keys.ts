/**
 * Deterministic S3 Object Keys as specified in SDD §7.
 */

export function rawSourceKey(videoId: string, ext = 'mp4'): string {
  const cleanExt = ext.startsWith('.') ? ext.slice(1) : ext;
  return `raw/${videoId}/source.${cleanExt}`;
}

export function masterPlaylistKey(videoId: string, generation = 1): string {
  if (generation > 1) {
    return `videos/${videoId}/hls/g${generation}/master.m3u8`;
  }
  return `videos/${videoId}/hls/master.m3u8`;
}

export function renditionPlaylistKey(videoId: string, rendition: string, generation = 1): string {
  if (generation > 1) {
    return `videos/${videoId}/hls/g${generation}/${rendition}/index.m3u8`;
  }
  return `videos/${videoId}/hls/${rendition}/index.m3u8`;
}

export function segmentKey(
  videoId: string,
  rendition: string,
  segmentIndex: number,
  generation = 1
): string {
  const paddedIndex = String(segmentIndex).padStart(5, '0');
  if (generation > 1) {
    return `videos/${videoId}/hls/g${generation}/${rendition}/seg_${paddedIndex}.ts`;
  }
  return `videos/${videoId}/hls/${rendition}/seg_${paddedIndex}.ts`;
}

export function posterKey(videoId: string): string {
  return `videos/${videoId}/thumbs/poster.jpg`;
}

export function spriteKey(videoId: string): string {
  return `videos/${videoId}/thumbs/sprite.jpg`;
}

export function spriteVttKey(videoId: string): string {
  return `videos/${videoId}/thumbs/sprite.vtt`;
}

export function metaKey(videoId: string): string {
  return `videos/${videoId}/meta.json`;
}
