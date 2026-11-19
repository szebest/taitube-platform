import { cn } from '@kit/ui';
import type { ComponentPropsWithRef } from 'react';
import type { SpriteSheet, SpriteStripShade } from './types';
import { spriteFrameStyle } from './utils/sprite-frame';

const MS_PER_SECOND = 1000;
const DEFAULT_FRAMES = 8;

export interface SpriteStripProps extends Omit<ComponentPropsWithRef<'div'>, 'children'> {
  sprite: SpriteSheet;
  durationMs: number;
  /** How many evenly spaced frames lie side by side. */
  frames?: number;
  /** The span left clear; everything outside it is dimmed. Left out, nothing is dimmed. */
  shade?: SpriteStripShade;
}

const percentOf = (ms: number, durationMs: number) => `${(ms / durationMs) * 100}%`;

/** Frames of a video side by side along its length: decoration for a control that sits over it. */
export function SpriteStrip({
  sprite,
  durationMs,
  frames = DEFAULT_FRAMES,
  shade,
  className,
  ...props
}: SpriteStripProps) {
  const durationSeconds = durationMs / MS_PER_SECOND;

  return (
    <div
      data-slot="sprite-strip"
      aria-hidden="true"
      className={cn('relative flex overflow-hidden rounded-thumb', className)}
      {...props}
    >
      {Array.from({ length: frames }, (_, index) => (
        <div
          key={index}
          className="min-w-0 flex-1 bg-surface"
          style={spriteFrameStyle(
            sprite,
            durationSeconds,
            ((index + 0.5) * durationSeconds) / frames
          )}
        />
      ))}
      {shade && (
        <>
          <div
            className="absolute inset-y-0 inset-s-0 bg-scrim"
            style={{ inlineSize: percentOf(shade.startMs, durationMs) }}
          />
          <div
            className="absolute inset-y-0 inset-e-0 bg-scrim"
            style={{ inlineSize: percentOf(durationMs - shade.endMs, durationMs) }}
          />
        </>
      )}
    </div>
  );
}
