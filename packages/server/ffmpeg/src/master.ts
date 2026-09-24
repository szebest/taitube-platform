import { MS_PER_SECOND } from '@vp/domain/time';
import type { LadderEntry } from '@vp/job-contracts';

function getAvcCodecString(profile: 'main' | 'high' | string, level: string): string {
  const profileHex = profile === 'high' ? '6400' : '4d40';
  const levelNum = Math.round(Number.parseFloat(level) * 10);
  const levelHex = levelNum.toString(16).padStart(2, '0');
  return `avc1.${profileHex}${levelHex}`;
}

export interface MasterPlaylistOptions {
  ladder: LadderEntry[];
  fps: number | undefined;
  measuredResults?: Record<string, { bytes?: number; durationMs?: number; avgBitrateBps?: number }>;
}

/**
 * Generates an RFC 8216 / Apple HLS authoring-compliant master playlist (SDD §8.4).
 */
export function generateMasterPlaylist(options: MasterPlaylistOptions): string {
  const { ladder, fps, measuredResults } = options;
  const frameRate = fps === undefined ? '' : `,FRAME-RATE=${fps.toFixed(3)}`;

  const lines: string[] = ['#EXTM3U', '#EXT-X-VERSION:6', '#EXT-X-INDEPENDENT-SEGMENTS'];

  const sorted = [...ladder].sort((a, b) => b.height - a.height);

  for (const r of sorted) {
    const bandwidth = r.maxrateKbps * 1000;
    const measured = measuredResults?.[r.name];
    let avgBandwidth: number;
    if (measured?.avgBitrateBps) {
      avgBandwidth = measured.avgBitrateBps;
    } else if (measured?.bytes && measured?.durationMs && measured.durationMs > 0) {
      avgBandwidth = Math.round((measured.bytes * 8) / (measured.durationMs / MS_PER_SECOND));
    } else {
      avgBandwidth = (r.videoKbps + r.audioKbps) * 1000;
    }

    const resolution = `${r.width}x${r.height}`;
    const avcCodec = getAvcCodecString(r.profile, r.level);
    const codecs = `${avcCodec},mp4a.40.2`;

    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},AVERAGE-BANDWIDTH=${avgBandwidth},RESOLUTION=${resolution}${frameRate},CODECS="${codecs}"`,
      `${r.name}/index.m3u8`
    );
  }

  return `${lines.join('\n')}\n`;
}
