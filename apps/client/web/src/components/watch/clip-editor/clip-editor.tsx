import { CLIP_MAX_MS, CLIP_MIN_MS } from '@vp/domain';
import { cn, Slider } from '@vp/ui';
import type { ComponentPropsWithRef } from 'react';
import { ClipEditorContext, useClipEditor } from './clip-editor.context';
import { spriteFrameStyle } from './sprite-frame';
import type { ClipEditorSprite, ClipEditorValue } from './types';

const MS_PER_SECOND = 1000;
const FRAMES = 8;

export interface ClipEditorRootProps extends ComponentPropsWithRef<'div'> {
  durationMs: number;
  range: ClipEditorValue;
  onRangeChange: (range: ClipEditorValue) => void;
}

/** The range of a video being clipped, shared by its preview and its range picker. */
export function ClipEditorRoot({
  durationMs,
  range,
  onRangeChange,
  className,
  ...props
}: ClipEditorRootProps) {
  return (
    <ClipEditorContext value={{ durationMs, range, onRangeChange }}>
      <div
        data-slot="clip-editor"
        className={cn('tw:flex tw:flex-col tw:gap-stack', className)}
        {...props}
      />
    </ClipEditorContext>
  );
}

/** The frame the preview player sits in, in the video's own proportions. */
export function ClipEditorPreview({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      data-slot="clip-editor-preview"
      className={cn(
        'tw:aspect-video tw:w-full tw:overflow-hidden tw:rounded-thumb tw:bg-media',
        className
      )}
      {...props}
    />
  );
}

export interface ClipEditorRangeProps extends ComponentPropsWithRef<'fieldset'> {
  /** Frames of the video to lay under the slider; without it the slider stands alone. */
  sprite?: ClipEditorSprite;
  startLabel: string;
  endLabel: string;
  /** What the range says in words, finished by the caller and announced as it changes. */
  summary: string;
}

function percentOf(ms: number, durationMs: number): string {
  return `${(ms / durationMs) * 100}%`;
}

/** Two thumbs on a strip of the video's frames: the range stays 5 to 60 seconds by the domain's own bounds. */
export function ClipEditorRange({
  sprite,
  startLabel,
  endLabel,
  summary,
  className,
  ...props
}: ClipEditorRangeProps) {
  const { durationMs, range, onRangeChange } = useClipEditor('Range');
  const span = Math.floor(durationMs / MS_PER_SECOND) * MS_PER_SECOND;

  const change = ([start = 0, end = 0]: number[]) => {
    const startMs = start * MS_PER_SECOND;
    const endMs = end * MS_PER_SECOND;
    const tooLong = endMs - startMs > CLIP_MAX_MS;
    const movedStart = startMs !== range.startMs;

    onRangeChange({
      startMs: tooLong && !movedStart ? endMs - CLIP_MAX_MS : startMs,
      endMs: tooLong && movedStart ? startMs + CLIP_MAX_MS : endMs,
    });
  };

  return (
    <fieldset
      data-slot="clip-editor-range"
      className={cn(
        'tw:m-0 tw:flex tw:min-w-0 tw:flex-col tw:gap-inline tw:border-0 tw:p-0',
        className
      )}
      {...props}
    >
      {sprite && (
        <div
          data-slot="clip-editor-frames"
          aria-hidden="true"
          className="tw:relative tw:flex tw:overflow-hidden tw:rounded-thumb"
        >
          {Array.from({ length: FRAMES }, (_, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: frames are positions along the strip, with no identity of their own.
              key={index}
              className="tw:min-w-0 tw:flex-1 tw:bg-surface"
              style={spriteFrameStyle(
                sprite,
                span / MS_PER_SECOND,
                ((index + 0.5) * span) / FRAMES / MS_PER_SECOND
              )}
            />
          ))}
          <div
            className="tw:absolute tw:inset-y-0 tw:inset-s-0 tw:bg-scrim tw:opacity-70"
            style={{ inlineSize: percentOf(range.startMs, span) }}
          />
          <div
            className="tw:absolute tw:inset-y-0 tw:inset-e-0 tw:bg-scrim tw:opacity-70"
            style={{ inlineSize: percentOf(span - range.endMs, span) }}
          />
        </div>
      )}
      <Slider.Root
        min={0}
        max={span / MS_PER_SECOND}
        step={1}
        minStepsBetweenThumbs={CLIP_MIN_MS / MS_PER_SECOND}
        value={[range.startMs / MS_PER_SECOND, range.endMs / MS_PER_SECOND]}
        onValueChange={change}
      >
        <Slider.Thumb aria-label={startLabel} />
        <Slider.Thumb aria-label={endLabel} />
      </Slider.Root>
      <p aria-live="polite" className="tw:m-0 tw:text-body-sm tw:text-fg-muted">
        {summary}
      </p>
    </fieldset>
  );
}
