import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../../lib/variant-names';
import { Spinner } from '../spinner';
import { spinnerStyles } from '../spinner.variants';

const meta = {
  title: 'Primitives/Spinner',
  component: Spinner,
  args: { children: 'Saving' },
} satisfies Meta<typeof Spinner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SizesAndTones: Story = {
  render: (args) => (
    <div className="flex flex-col gap-stack text-body text-fg">
      {variantNames(spinnerStyles.variants.tone).map((tone) => (
        <div key={tone} className="flex items-center gap-inline">
          {variantNames(spinnerStyles.variants.size).map((size) => (
            <Spinner key={size} {...args} size={size} tone={tone} />
          ))}
        </div>
      ))}
      <p className="flex items-center gap-inline">
        <Spinner size="sm" />
        Processing your video
      </p>
      <div className="flex h-40 items-center justify-center rounded-card bg-surface">
        <Spinner size="lg">Loading comments</Spinner>
      </div>
    </div>
  ),
};
