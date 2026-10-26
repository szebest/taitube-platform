/**
 * Deterministic S3 Object Keys as specified in SDD §7.
 */

export function rawPrefix(videoId: string): string {
  return `raw/${videoId}/`;
}

export function rawSourceKey(videoId: string, ext = 'mp4'): string {
  const cleanExt = ext.startsWith('.') ? ext.slice(1) : ext;
  return `${rawPrefix(videoId)}source.${cleanExt}`;
}

export function videoPrefix(videoId: string): string {
  return `videos/${videoId}/`;
}

function hlsPrefix(videoId: string, generation: number): string {
  const hls = `${videoPrefix(videoId)}hls`;
  return generation > 1 ? `${hls}/g${generation}` : hls;
}

/** Generation 1 is never listed: it writes into `hls/` itself, whose prefix holds the live video. */
export function reprocessPrefixesBefore(videoId: string, currentGeneration: number): string[] {
  const prefixes: string[] = [];
  for (let generation = 2; generation < currentGeneration; generation += 1) {
    prefixes.push(`${hlsPrefix(videoId, generation)}/`);
  }
  return prefixes;
}

export function renditionPrefix(videoId: string, rendition: string, generation = 1): string {
  return `${hlsPrefix(videoId, generation)}/${rendition}/`;
}

export function masterPlaylistKey(videoId: string, generation = 1): string {
  return `${hlsPrefix(videoId, generation)}/master.m3u8`;
}

/** Any object ffmpeg writes into a rendition directory, addressed by its file name. */
export function renditionObjectKey(
  videoId: string,
  rendition: string,
  filename: string,
  generation = 1
): string {
  return `${renditionPrefix(videoId, rendition, generation)}${filename}`;
}

export function renditionPlaylistKey(videoId: string, rendition: string, generation = 1): string {
  return renditionObjectKey(videoId, rendition, 'index.m3u8', generation);
}

export function chunkPrefix(videoId: string, generation: number, rendition: string): string {
  return `tmp/chunks/${videoId}/g${generation}/${rendition}/`;
}

export function chunkKey(
  videoId: string,
  generation: number,
  rendition: string,
  chunkIndex: number
): string {
  return `${chunkPrefix(videoId, generation, rendition)}chunk_${String(chunkIndex).padStart(5, '0')}.mp4`;
}

export function captionsPrefix(videoId: string): string {
  return `${videoPrefix(videoId)}captions/`;
}

export function captionsFileKey(videoId: string, language: string): string {
  return `${captionsPrefix(videoId)}${language}/captions.vtt`;
}

/** Raw bucket: the windows a long source's captions run writes before its merge joins them. */
export function captionsTmpPrefix(videoId: string): string {
  return `tmp/captions/${videoId}/`;
}

export function captionsChunkKey(
  videoId: string,
  modelVersion: string,
  captionVersion: number,
  window: number
): string {
  return `${captionsTmpPrefix(videoId)}${modelVersion}/v${captionVersion}/w${window}.json`;
}

export function posterKey(videoId: string): string {
  return `${videoPrefix(videoId)}thumbs/poster.jpg`;
}

export function spriteKey(videoId: string): string {
  return `${videoPrefix(videoId)}thumbs/sprite.jpg`;
}

export function spriteVttKey(videoId: string): string {
  return `${videoPrefix(videoId)}thumbs/sprite.vtt`;
}

export function sanitizeStorageUrl(url: string): string {
  if (!URL.canParse(url)) return url;
  const parsed = new URL(url);
  parsed.search = '';
  return parsed.toString();
}
