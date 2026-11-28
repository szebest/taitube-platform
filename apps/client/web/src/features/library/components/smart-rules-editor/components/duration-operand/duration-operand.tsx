import { Select, Slider } from '@kit/ui';
import {
  type ConditionDraft,
  type DurationOp,
  minutesFor,
} from '#app/features/library/utils/rules-form';
import { useT } from '#app/lib/messages';

const OPS = ['under', 'over', 'between'] as const satisfies readonly DurationOp[];
const MAX_MINUTES = 180;

type DurationDraft = Extract<ConditionDraft, { field: 'duration' }>;

export interface DurationOperandProps {
  condition: DurationDraft;
  onChange: (condition: DurationDraft) => void;
}

/** Under, over or between a number of minutes: one thumb for a bound, two for a range. */
export function DurationOperand({ condition, onChange }: DurationOperandProps) {
  const { tOr } = useT();

  const { op, minutes } = condition;
  const [first = 1, second = first] = minutes;
  const shown =
    op === 'between'
      ? tOr('playlistTools.minutesRange', { min: first, max: second }, '')
      : tOr('playlistTools.minutes', { count: first }, '');

  return (
    <>
      <Select.Root
        value={op}
        onValueChange={(next) => {
          const picked = OPS.find((option) => option === next);
          if (picked) onChange({ ...condition, op: picked, minutes: minutesFor(picked, minutes) });
        }}
      >
        <Select.Trigger aria-label={tOr('playlistTools.durationOpLabel', {}, '')}>
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          {OPS.map((option) => (
            <Select.Item key={option} value={option}>
              {tOr('playlistTools.durationOp', { mode: option }, '')}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
      <div className="flex min-w-0 flex-1 basis-48 items-center gap-inline">
        <Slider.Root
          min={1}
          max={MAX_MINUTES}
          minStepsBetweenThumbs={1}
          value={minutes}
          onValueChange={(next) => onChange({ ...condition, minutes: next })}
        >
          <Slider.Thumb aria-label={tOr('playlistTools.minutesLabel', {}, '')} />
          {op === 'between' && (
            <Slider.Thumb aria-label={tOr('playlistTools.minutesLabel', {}, '')} />
          )}
        </Slider.Root>
        <span className="shrink-0 tabular-nums text-body-sm">{shown}</span>
      </div>
    </>
  );
}
