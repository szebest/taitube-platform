import type { LadderEntry } from '@vp/job-contracts';

export function getAvcCodecString(profile: 'main' | 'high' | string, level: string): string {
  const profileHex = profile === 'high' ? '6400' : '4d40';
  const levelNum = Math.round(Number.parseFloat(level) * 10);
  const levelHex = levelNum.toString(16).padStart(2, '0');
  return `avc1.${profileHex}${levelHex}`;
}

export interface MasterPlaylistOptions {
  ladder: LadderEntry[];
  fps?: number;
}

/**
 * Generates an RFC 8216 / Apple HLS authoring-compliant master playlist (SDD §8.4).
 */
export function generateMasterPlaylist(options: MasterPlaylistOptions): string {
  const { ladder, fps = 24 } = options;
  const frameRateStr = Number(fps).toFixed(3);

  const lines: string[] = ['#EXTM3U', '#EXT-X-VERSION:6', '#EXT-X-INDEPENDENT-SEGMENTS'];

  // Sort renditions from highest resolution to lowest per HLS conventions
  const sorted = [...ladder].sort((a, b) => b.height - a.height);

  for (const r of sorted) {
    const bandwidth = r.maxrateKbps * 1000;
    const avgBandwidth = (r.videoKbps + r.audioKbps) * 1000;
    const resolution = `${r.width}x${r.height}`;
    const avcCodec = getAvcCodecString(r.profile, r.level);
    const codecs = `${avcCodec},mp4a.40.2`;

    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},AVERAGE-BANDWIDTH=${avgBandwidth},RESOLUTION=${resolution},FRAME-RATE=${frameRateStr},CODECS="${codecs}"`,
      `${r.name}/index.m3u8`
    );
  }

  return `${lines.join('\n')}\n`;
}
