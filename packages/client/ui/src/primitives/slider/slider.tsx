import { Slider as SliderPrimitive } from 'radix-ui';
import { type ComponentPropsWithRef, useMemo } from 'react';
import { SliderContext, useSlider } from './slider.context';
import { sliderStyles } from './slider.variants';
import type { SliderSize, SliderTone } from './types';

export interface SliderRootProps extends ComponentPropsWithRef<typeof SliderPrimitive.Root> {
  size?: SliderSize;
  tone?: SliderTone;
}

/** One `Slider.Thumb` per value, each named with `aria-label`; the track and range are built in. */
export function SliderRoot({
  size = 'md',
  tone = 'accent',
  orientation = 'horizontal',
  className,
  children,
  ...props
}: SliderRootProps) {
  const shared = useMemo(() => ({ size, tone, orientation }), [size, tone, orientation]);
  const styles = sliderStyles(shared);

  return (
    <SliderContext value={shared}>
      <SliderPrimitive.Root
        data-slot="slider"
        orientation={orientation}
        className={styles.root({ className })}
        {...props}
      >
        <SliderPrimitive.Track data-slot="slider-track" className={styles.track()}>
          <SliderPrimitive.Range data-slot="slider-range" className={styles.range()} />
        </SliderPrimitive.Track>
        {children}
      </SliderPrimitive.Root>
    </SliderContext>
  );
}

export type SliderThumbProps = ComponentPropsWithRef<typeof SliderPrimitive.Thumb>;

export function SliderThumb({ className, ...props }: SliderThumbProps) {
  const shared = useSlider('Thumb');

  return (
    <SliderPrimitive.Thumb
      data-slot="slider-thumb"
      className={sliderStyles(shared).thumb({ className })}
      {...props}
    />
  );
}
