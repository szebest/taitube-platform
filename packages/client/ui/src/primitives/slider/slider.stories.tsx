import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../lib/variant-names';
import { Slider } from '.';
import { SliderRoot } from './slider';
import { sliderStyles } from './slider.variants';

const meta = {
  title: 'Primitives/Slider',
  tags: ['text'],
  component: SliderRoot,
} satisfies Meta<typeof SliderRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TonesAndSizes: Story = {
  render: () => (
    <div className="flex max-w-[24rem] flex-col gap-stack">
      {variantNames(sliderStyles.variants.tone).flatMap((tone) =>
        variantNames(sliderStyles.variants.size).map((size) => (
          <Slider.Root key={`${tone}-${size}`} tone={tone} size={size} defaultValue={[40]}>
            <Slider.Thumb aria-label={`${tone} ${size}`} />
          </Slider.Root>
        ))
      )}
    </div>
  ),
};

export const RangeVerticalAndDisabled: Story = {
  render: () => (
    <div className="flex items-start gap-stack">
      <div className="w-48">
        <Slider.Root defaultValue={[20, 70]}>
          <Slider.Thumb aria-label="From" />
          <Slider.Thumb aria-label="To" />
        </Slider.Root>
      </div>
      <div className="h-32">
        <Slider.Root orientation="vertical" defaultValue={[60]} tone="neutral" size="sm">
          <Slider.Thumb aria-label="Volume" />
        </Slider.Root>
      </div>
      <div className="w-48">
        <Slider.Root disabled defaultValue={[50]}>
          <Slider.Thumb aria-label="Disabled" />
        </Slider.Root>
      </div>
    </div>
  ),
};
