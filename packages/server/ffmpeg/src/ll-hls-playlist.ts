import { MS_PER_SECOND } from '@vp/domain/time';

export interface LlHlsPart {
  uri: string;
  durationMs: number;
  independent: boolean;
}

/**
 * `discontinuity` is the discontinuity sequence number the segment belongs to: it rises by one each
 * time the packager restarts, which is also when `mapUri` changes.
 */
export interface LlHlsSegment {
  sequence: number;
  discontinuity: number;
  mapUri: string;
  uri: string;
  durationMs: number;
  parts: readonly LlHlsPart[];
}

/** The segment being written: its parts are listed, its whole URI does not exist yet. */
type LlHlsOpenSegment = Omit<LlHlsSegment, 'uri' | 'durationMs'>;

export interface LivePlaylistInput {
  /** The sliding window, oldest first. */
  segments: readonly LlHlsSegment[];
  open: LlHlsOpenSegment | null;
  segmentMs: number;
  partMs: number;
  /** How many of the newest whole segments keep their parts listed. */
  partSegments: number;
}

export interface ArchivePlaylistInput {
  segments: readonly LlHlsSegment[];
  segmentMs: number;
  ended: boolean;
}

const seconds = (ms: number) => (ms / MS_PER_SECOND).toFixed(3);

function targetDuration(segments: readonly LlHlsSegment[], segmentMs: number): number {
  return Math.max(1, ...[segmentMs, ...segments.map((s) => s.durationMs)].map(roundSeconds));
}

function roundSeconds(ms: number): number {
  return Math.round(ms / MS_PER_SECOND);
}

function partLine(part: LlHlsPart): string {
  const independent = part.independent ? ',INDEPENDENT=YES' : '';
  return `#EXT-X-PART:DURATION=${seconds(part.durationMs)},URI="${part.uri}"${independent}`;
}

/** Emits the discontinuity and map tags a segment needs, given the one rendered before it. */
class SegmentWriter {
  readonly lines: string[] = [];
  private discontinuity: number | undefined;
  private mapUri: string | undefined;

  enter(segment: LlHlsOpenSegment): void {
    if (this.discontinuity !== undefined && segment.discontinuity !== this.discontinuity) {
      this.lines.push('#EXT-X-DISCONTINUITY');
    }
    if (segment.mapUri !== this.mapUri) this.lines.push(`#EXT-X-MAP:URI="${segment.mapUri}"`);
    this.discontinuity = segment.discontinuity;
    this.mapUri = segment.mapUri;
  }
}

/**
 * The live media playlist (RFC 8216bis 4.4.4.9 and 4.4.5.1): whole segments on a sliding window, the
 * parts of the newest few and of the segment being written. Served as static objects, so it offers
 * no blocking reload and no preload hint.
 */
export function renderLivePlaylist(input: LivePlaylistInput): string {
  const { segments, open, segmentMs, partMs, partSegments } = input;
  const first = segments[0] ?? open;
  const writer = new SegmentWriter();

  for (const [index, segment] of segments.entries()) {
    writer.enter(segment);
    if (index >= segments.length - partSegments) writer.lines.push(...segment.parts.map(partLine));
    writer.lines.push(`#EXTINF:${seconds(segment.durationMs)},`, segment.uri);
  }
  if (open !== null && open.parts.length > 0) {
    writer.enter(open);
    writer.lines.push(...open.parts.map(partLine));
  }

  return `${[
    '#EXTM3U',
    '#EXT-X-VERSION:9',
    `#EXT-X-TARGETDURATION:${targetDuration(segments, segmentMs)}`,
    `#EXT-X-SERVER-CONTROL:PART-HOLD-BACK=${seconds(3 * partMs)}`,
    `#EXT-X-PART-INF:PART-TARGET=${seconds(partMs)}`,
    `#EXT-X-MEDIA-SEQUENCE:${first?.sequence ?? 0}`,
    `#EXT-X-DISCONTINUITY-SEQUENCE:${first?.discontinuity ?? 0}`,
    ...writer.lines,
  ].join('\n')}\n`;
}

/**
 * Every segment of the broadcast, which is the archive: an `EVENT` playlist while it runs, closed with
 * `#EXT-X-ENDLIST` when it ends, so the same object serves the replay with nothing re-encoded.
 */
export function renderArchivePlaylist(input: ArchivePlaylistInput): string {
  const { segments, segmentMs, ended } = input;
  const writer = new SegmentWriter();

  for (const segment of segments) {
    writer.enter(segment);
    writer.lines.push(`#EXTINF:${seconds(segment.durationMs)},`, segment.uri);
  }

  return `${[
    '#EXTM3U',
    '#EXT-X-VERSION:6',
    `#EXT-X-TARGETDURATION:${targetDuration(segments, segmentMs)}`,
    '#EXT-X-PLAYLIST-TYPE:EVENT',
    `#EXT-X-MEDIA-SEQUENCE:${segments[0]?.sequence ?? 0}`,
    ...writer.lines,
    ...(ended ? ['#EXT-X-ENDLIST'] : []),
  ].join('\n')}\n`;
}
