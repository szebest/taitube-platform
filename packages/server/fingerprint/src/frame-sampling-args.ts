export const FRAME_WIDTH = 9;
export const FRAME_HEIGHT = 8;
export const FRAME_BYTES = FRAME_WIDTH * FRAME_HEIGHT;

interface FrameSamplingArgsOptions {
  sourcePath: string;
  intervalSeconds: number;
}

/**
 * One 9x8 greyscale frame every `intervalSeconds`, as raw bytes on stdout: nine columns give eight
 * left-to-right comparisons per row for the 64-bit dHash. `area` scaling averages the source pixels,
 * which is what keeps the hash steady across re-encodes and resolutions.
 */
export function buildFrameSamplingArgs(options: FrameSamplingArgsOptions): string[] {
  return [
    '-hide_banner',
    '-nostdin',
    '-loglevel',
    'error',
    '-i',
    options.sourcePath,
    '-an',
    '-sn',
    '-vf',
    `fps=1/${options.intervalSeconds},scale=${FRAME_WIDTH}:${FRAME_HEIGHT}:flags=area,format=gray`,
    '-f',
    'rawvideo',
    '-pix_fmt',
    'gray',
    'pipe:1',
  ];
}
