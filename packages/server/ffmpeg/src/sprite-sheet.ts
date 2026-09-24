import { MS_PER_SECOND, SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from '@vp/domain/time';

/** The sprite sheet's geometry; the WebVTT cues and the tiling filter both read it. */
export interface SpriteLayout {
  intervalSec: number;
  columns: number;
  tileWidth: number;
  tileHeight: number;
}

interface SpriteGrid {
  durationSec: number;
  frameCount: number;
  rows: number;
  columns: number;
}

export function calculateSpriteGrid(
  durationMs: number,
  { intervalSec, columns }: SpriteLayout
): SpriteGrid {
  const durationSec = durationMs / MS_PER_SECOND;
  const frameCount = Math.max(1, Math.ceil(durationSec / intervalSec));
  const rows = Math.max(1, Math.ceil(frameCount / columns));
  return { durationSec, frameCount, rows, columns };
}

interface GenerateSpriteVttOptions {
  durationMs: number;
  layout: SpriteLayout;
  spriteFilename?: string;
}

function formatVttTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / MS_PER_SECOND);
  const milliseconds = Math.floor(ms % MS_PER_SECOND);
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

export function generateSpriteVtt(options: GenerateSpriteVttOptions): string {
  const { durationMs, layout, spriteFilename = 'sprite.jpg' } = options;
  const { intervalSec, columns, tileWidth, tileHeight } = layout;

  const { frameCount } = calculateSpriteGrid(durationMs, layout);
  const intervalMs = intervalSec * MS_PER_SECOND;

  const lines: string[] = ['WEBVTT', ''];

  for (let i = 0; i < frameCount; i++) {
    const startMs = i * intervalMs;
    const endMs = Math.min(durationMs, (i + 1) * intervalMs);
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = col * tileWidth;
    const y = row * tileHeight;

    lines.push(
      `${formatVttTimestamp(startMs)} --> ${formatVttTimestamp(endMs)}`,
      `${spriteFilename}#xywh=${x},${y},${tileWidth},${tileHeight}`,
      ''
    );
  }

  return lines.join('\n');
}
