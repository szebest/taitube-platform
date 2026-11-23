import { useT } from '@kit/intl-react';
import { Field, Input, Select, Slider } from '@kit/ui';
import { BLUR_MAX_STRENGTH, BLUR_MIN_STRENGTH, BLUR_SHAPES, type BlurRegion } from '@vp/domain';

type Edge = 'x' | 'y' | 'w' | 'h';

const EDGES: {
  edge: Edge;
  label: 'studio.blurLeft' | 'studio.blurTop' | 'studio.blurWidth' | 'studio.blurHeight';
}[] = [
  { edge: 'x', label: 'studio.blurLeft' },
  { edge: 'y', label: 'studio.blurTop' },
  { edge: 'w', label: 'studio.blurWidth' },
  { edge: 'h', label: 'studio.blurHeight' },
];

const PERCENT = 100;

export interface BlurFieldsProps {
  blur: BlurRegion;
  onChange: (blur: BlurRegion) => void;
}

/**
 * Where a blurred region sits in the frame, as percentages of its width and height, its shape and how
 * strongly it is blurred. Typed numbers rather than a box drawn over the stage: the studio has no player.
 */
export function BlurFields({ blur, onChange }: BlurFieldsProps) {
  const { tOr } = useT();

  return (
    <div className="flex flex-wrap items-end gap-stack">
      <Field.Root className="basis-40">
        <Field.Label>{tOr('studio.blurShape', {}, '')}</Field.Label>
        <Select.Root
          value={blur.shape}
          onValueChange={(shape) => {
            const known = BLUR_SHAPES.find((candidate) => candidate === shape);
            if (known) onChange({ ...blur, shape: known });
          }}
        >
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            {BLUR_SHAPES.map((shape) => (
              <Select.Item key={shape} value={shape}>
                {tOr('studio.blurShapeOption', { shape }, '')}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </Field.Root>
      {EDGES.map(({ edge, label }) => (
        <Field.Root key={edge} className="w-32">
          <Field.Label>{tOr(label, {}, '')}</Field.Label>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={PERCENT}
            value={Math.round(blur[edge] * PERCENT)}
            onChange={(event) =>
              onChange({ ...blur, [edge]: Number(event.target.value) / PERCENT })
            }
          />
        </Field.Root>
      ))}
      <Field.Root className="min-w-40 flex-1">
        <Field.Label>{tOr('studio.blurStrength', {}, '')}</Field.Label>
        <Slider.Root
          min={BLUR_MIN_STRENGTH}
          max={BLUR_MAX_STRENGTH}
          step={1}
          value={[blur.strength]}
          onValueChange={([strength]) => strength !== undefined && onChange({ ...blur, strength })}
        >
          <Slider.Thumb aria-label={tOr('studio.blurStrength', {}, '')} />
        </Slider.Root>
      </Field.Root>
    </div>
  );
}
