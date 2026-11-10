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

/** Evidence for a held or flagged video, in the raw bucket under a prefix its 7 day lifecycle does not cover. */
export function evidencePrefix(videoId: string): string {
  return `evidence/${videoId}/`;
}

export function evidenceFrameKey(videoId: string, index: number): string {
  return `${evidencePrefix(videoId)}frame-${index}.jpg`;
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

/** @internal */
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

function channelImagePrefix(channelId: string, kind: string): string {
  return `channels/${channelId}/${kind}/`;
}

/** Raw bucket: the file a creator uploaded for an avatar or banner, until the job has cut its variants. */
export function channelImageUploadKey(channelId: string, kind: string, uploadId: string): string {
  return `channel-images/${channelId}/${kind}/${uploadId}`;
}

/** Public bucket: every variant of one version of an avatar or banner, so a version is purged by its prefix. */
export function channelImageVersionPrefix(
  channelId: string,
  kind: string,
  version: number
): string {
  return `${channelImagePrefix(channelId, kind)}v${version}/`;
}

export function channelImageVariantKey(
  channelId: string,
  kind: string,
  variant: string,
  version: number
): string {
  return `${channelImageVersionPrefix(channelId, kind, version)}${variant}.webp`;
}

/** Drops what can carry a credential: the query (a presigned signature) and the user info. */
export function sanitizeStorageUrl(url: string): string {
  if (!URL.canParse(url)) return url;
  const parsed = new URL(url);
  parsed.search = '';
  parsed.username = '';
  parsed.password = '';
  return parsed.toString();
}

/** Public bucket: everything one broadcast writes, addressed by the live stream's id, not a video's. */
export function livePrefix(streamId: string): string {
  return `live/${streamId}/`;
}

/** A packager restarted mid-broadcast writes a new epoch, so its init segment never overwrites one in use. */
function liveEpochPrefix(streamId: string, epoch: number): string {
  return `${livePrefix(streamId)}${epoch}/`;
}

export function liveInitKey(streamId: string, epoch: number): string {
  return `${liveEpochPrefix(streamId, epoch)}init.mp4`;
}

export function liveSegmentKey(streamId: string, epoch: number, sequence: number): string {
  return `${liveEpochPrefix(streamId, epoch)}${sequence}.m4s`;
}

export function livePartKey(
  streamId: string,
  epoch: number,
  sequence: number,
  part: number
): string {
  return `${liveEpochPrefix(streamId, epoch)}${sequence}.${part}.m4s`;
}

export function liveMasterKey(streamId: string): string {
  return `${livePrefix(streamId)}master.m3u8`;
}

export function livePlaylistKey(streamId: string): string {
  return `${livePrefix(streamId)}index.m3u8`;
}

export function liveArchivePlaylistKey(streamId: string): string {
  return `${livePrefix(streamId)}archive.m3u8`;
}

/** The archive's segment list as data, so a packager that restarts carries the broadcast on. */
export function liveArchiveStateKey(streamId: string): string {
  return `${livePrefix(streamId)}archive.json`;
}

/** A key under `livePrefix`, as a URI relative to the playlists that sit at the prefix's root. */
export function liveRelativeUri(streamId: string, key: string): string {
  const prefix = livePrefix(streamId);
  return key.startsWith(prefix) ? key.slice(prefix.length) : key;
}
