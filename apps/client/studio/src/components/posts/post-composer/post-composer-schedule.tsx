import { DateTimePicker, Field, SegmentedControl } from '@kit/ui';
import { useT } from '#app/lib/messages';
import { usePostComposer } from './post-composer.context';
import type { PostTimingChoice } from './types';

const CHOICES = ['now', 'draft', 'schedule'] as const satisfies readonly PostTimingChoice[];

const isChoice = (value: string): value is PostTimingChoice =>
  CHOICES.some((choice) => choice === value);

export interface PostComposerScheduleProps {
  /** The post is already published, so it stays so and there is nothing to choose. */
  published?: boolean;
}

/** Publish now, keep a draft, or publish at a time of the creator's own clock. */
export function PostComposerSchedule({ published = false }: PostComposerScheduleProps) {
  const { tOr } = useT();
  const { draft, change } = usePostComposer('Schedule');

  if (published) return null;
  return (
    <div className="flex flex-col gap-stack">
      <SegmentedControl.Root
        aria-label={tOr('studio.composerTiming', {}, '')}
        value={draft.timing}
        onValueChange={(timing) => isChoice(timing) && change({ timing })}
      >
        {CHOICES.map((choice) => (
          <SegmentedControl.Item key={choice} value={choice}>
            {tOr('studio.composerTimingOption', { mode: choice }, '')}
          </SegmentedControl.Item>
        ))}
      </SegmentedControl.Root>
      {draft.timing === 'schedule' && (
        <Field.Root required>
          <Field.Label>{tOr('studio.composerPublishAt', {}, '')}</Field.Label>
          <DateTimePicker
            value={draft.publishAt}
            onValueChange={(publishAt) => change({ publishAt })}
            dateLabel={tOr('studio.composerDate', {}, '')}
            timeLabel={tOr('studio.composerTime', {}, '')}
          />
          <Field.Hint>{tOr('studio.composerPublishAtHint', {}, '')}</Field.Hint>
        </Field.Root>
      )}
    </div>
  );
}
