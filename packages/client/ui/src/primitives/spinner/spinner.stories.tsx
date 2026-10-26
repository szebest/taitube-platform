import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../lib/variant-names';
import { Spinner } from './spinner';
import { spinnerStyles } from './spinner.variants';

const meta = {
  title: 'Primitives/Spinner',
  component: Spinner,
  args: { children: 'Saving' },
} satisfies Meta<typeof Spinner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SizesAndTones: Story = {
  render: (args) => (
    <div className="tw:flex tw:flex-col tw:gap-stack tw:text-body tw:text-fg">
      {variantNames(spinnerStyles.variants.tone).map((tone) => (
        <div key={tone} className="tw:flex tw:items-center tw:gap-inline">
          {variantNames(spinnerStyles.variants.size).map((size) => (
            <Spinner key={size} {...args} size={size} tone={tone} />
          ))}
        </div>
      ))}
      <p className="tw:flex tw:items-center tw:gap-inline">
        <Spinner size="sm" />
        Processing your video
      </p>
      <div className="tw:flex tw:h-40 tw:items-center tw:justify-center tw:rounded-card tw:bg-surface">
        <Spinner size="lg">Loading comments</Spinner>
      </div>
    </div>
  ),
};
