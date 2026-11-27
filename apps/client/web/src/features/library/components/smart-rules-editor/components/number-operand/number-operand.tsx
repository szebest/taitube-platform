import { Slider } from '@kit/ui';

export interface NumberOperandProps {
  /** The finished name of the slider. */
  label: string;
  value: number;
  max: number;
  /** The value in words, beside the slider ("30 days"). */
  shown: string;
  onChange: (value: number) => void;
}

/** One whole number from 1 to `max` on a slider, with the value in words beside it. */
export function NumberOperand({ label, value, max, shown, onChange }: NumberOperandProps) {
  return (
    <div className="flex min-w-0 flex-1 basis-48 items-center gap-inline">
      <Slider.Root
        min={1}
        max={max}
        value={[value]}
        onValueChange={([next = value]) => onChange(next)}
      >
        <Slider.Thumb aria-label={label} />
      </Slider.Root>
      <span className="shrink-0 tabular-nums text-body-sm">{shown}</span>
    </div>
  );
}
