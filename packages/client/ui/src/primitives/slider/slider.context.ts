import { createCompoundContext } from '../../lib/create-compound-context';
import type { Orientation } from '../../types';
import type { SliderSize, SliderTone } from './types';

export const [SliderContext, useSlider] = createCompoundContext<{
  size: SliderSize;
  tone: SliderTone;
  orientation: Orientation;
}>('Slider');
