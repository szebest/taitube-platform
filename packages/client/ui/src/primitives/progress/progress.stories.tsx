import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../lib/variant-names';
import { Progress } from './progress';
import { progressStyles } from './progress.variants';

const meta = {
  title: 'Primitives/Progress',
  component: Progress,
  args: { 'aria-label': 'Upload progress', value: 40 },
} satisfies Meta<typeof Progress>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ValuesSizesAndTones: Story = {
  render: (args) => (
    <div className="tw:flex tw:max-w-md tw:flex-col tw:gap-stack tw:text-caption tw:text-fg-muted">
      {[0, 40, 100].map((value) => (
        <Progress key={value} {...args} value={value} />
      ))}
      <Progress {...args} value={undefined} />
      {variantNames(progressStyles.variants.tone).map((tone) =>
        variantNames(progressStyles.variants.size).map((size) => (
          <Progress key={`${tone}-${size}`} {...args} tone={tone} size={size} />
        ))
      )}
      <div className="tw:flex tw:items-center tw:gap-inline">
        <Progress {...args} value={62} className="tw:flex-1" />
        <span className="tw:font-mono tw:tabular-nums">62%</span>
      </div>
    </div>
  ),
};
