export interface FfmpegLadderSpec {
  name: '1080p' | '720p' | '480p';
  width: number;
  height: number;
  videoKbps: number;
  audioKbps: number;
}

export const DEFAULT_LADDER: readonly FfmpegLadderSpec[] = [
  { name: '1080p', width: 1920, height: 1080, videoKbps: 4500, audioKbps: 192 },
  { name: '720p', width: 1280, height: 720, videoKbps: 2200, audioKbps: 128 },
  { name: '480p', width: 854, height: 480, videoKbps: 800, audioKbps: 96 },
] as const;
