import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../lib/variant-names';
import { Slider } from '.';
import { SliderRoot } from './slider';
import { sliderStyles } from './slider.variants';

const meta = {
  title: 'Primitives/Slider',
  component: SliderRoot,
} satisfies Meta<typeof SliderRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TonesAndSizes: Story = {
  render: () => (
    <div className="tw:flex tw:max-w-[24rem] tw:flex-col tw:gap-stack">
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
    <div className="tw:flex tw:items-start tw:gap-stack">
      <div className="tw:w-48">
        <Slider.Root defaultValue={[20, 70]}>
          <Slider.Thumb aria-label="From" />
          <Slider.Thumb aria-label="To" />
        </Slider.Root>
      </div>
      <div className="tw:h-32">
        <Slider.Root orientation="vertical" defaultValue={[60]} tone="neutral" size="sm">
          <Slider.Thumb aria-label="Volume" />
        </Slider.Root>
      </div>
      <div className="tw:w-48">
        <Slider.Root disabled defaultValue={[50]}>
          <Slider.Thumb aria-label="Disabled" />
        </Slider.Root>
      </div>
    </div>
  ),
};
