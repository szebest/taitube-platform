import { type SpriteSheet, SpriteStrip } from '@kit/components';
import { assertNever } from '@kit/result';
import { cn, Slider } from '@kit/ui';
import type { ComponentPropsWithRef } from 'react';
import type { TimelineControl, TimelineMarker } from './types';
import { clampRange } from './utils/clamp-range';

const MS_PER_SECOND = 1000;

export interface TimelineRangeEditorProps extends Omit<
  ComponentPropsWithRef<'fieldset'>,
  'children' | 'onChange'
> {
  durationMs: number;
  control: TimelineControl;
  /** Frames of the video to lay under the slider; without it the slider stands alone. */
  sprite?: SpriteSheet;
  /** Ticks over the frames, each at its own time. */
  markers?: readonly TimelineMarker[];
  /** What the position or range says in words, finished by the caller and announced as it changes. */
  summary: string;
}

const percentOf = (ms: number, durationMs: number) => `${(ms / durationMs) * 100}%`;

function TimelineSlider({ control, spanMs }: { control: TimelineControl; spanMs: number }) {
  const sliderProps = { min: 0, max: spanMs / MS_PER_SECOND, step: 1 };

  switch (control.mode) {
    case 'range':
      return (
        <Slider.Root
          {...sliderProps}
          minStepsBetweenThumbs={control.minSpanMs / MS_PER_SECOND}
          value={[control.range.startMs / MS_PER_SECOND, control.range.endMs / MS_PER_SECOND]}
          onValueChange={(next) =>
            control.onRangeChange(clampRange(control.range, next, control.maxSpanMs))
          }
        >
          <Slider.Thumb aria-label={control.startLabel} />
          <Slider.Thumb aria-label={control.endLabel} />
        </Slider.Root>
      );
    case 'position':
      return (
        <Slider.Root
          {...sliderProps}
          value={[control.positionMs / MS_PER_SECOND]}
          onValueChange={([seconds = 0]) => control.onPositionChange(seconds * MS_PER_SECOND)}
        >
          <Slider.Thumb aria-label={control.label} />
        </Slider.Root>
      );
    default:
      return assertNever(control, 'TimelineControl');
  }
}

/**
 * One slider over a video's frames: two thumbs for a range or one for a position, with a tick for
 * each point already set. It holds no state, and the caller keeps a text field for typing a time.
 */
export function TimelineRangeEditor({
  durationMs,
  control,
  sprite,
  markers = [],
  summary,
  className,
  ...props
}: TimelineRangeEditorProps) {
  const spanMs = Math.floor(durationMs / MS_PER_SECOND) * MS_PER_SECOND;

  return (
    <fieldset
      data-slot="timeline-range-editor"
      className={cn('m-0 flex min-w-0 flex-col gap-inline border-0 p-0', className)}
      {...props}
    >
      <div className="relative flex flex-col gap-inline">
        {sprite && (
          <SpriteStrip
            sprite={sprite}
            durationMs={spanMs}
            shade={control.mode === 'range' ? control.range : undefined}
          />
        )}
        <TimelineSlider control={control} spanMs={spanMs} />
        <span aria-hidden="true" className="pointer-events-none absolute inset-0">
          {markers.map(({ id, ms, label, active }) => (
            <span
              key={id}
              data-slot="timeline-marker"
              data-active={active || undefined}
              title={label}
              style={{ insetInlineStart: percentOf(Math.min(ms, spanMs), spanMs) }}
              className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-fg data-active:bg-accent"
            />
          ))}
        </span>
      </div>
      <p aria-live="polite" className="m-0 text-body-sm text-fg-muted">
        {summary}
      </p>
    </fieldset>
  );
}
