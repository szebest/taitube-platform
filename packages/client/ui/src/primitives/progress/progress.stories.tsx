import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../lib/variant-names';
import { Progress } from './progress';
import { progressStyles } from './progress.variants';

const meta = {
  title: 'Primitives/Progress',
  tags: ['text'],
  component: Progress,
  args: { 'aria-label': 'Upload progress', value: 40 },
} satisfies Meta<typeof Progress>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ValuesSizesAndTones: Story = {
  render: (args) => (
    <div className="flex max-w-[28rem] flex-col gap-stack text-caption text-fg-muted">
      {[0, 40, 100].map((value) => (
        <Progress key={value} {...args} value={value} />
      ))}
      <Progress {...args} value={undefined} />
      {variantNames(progressStyles.variants.tone).map((tone) =>
        variantNames(progressStyles.variants.size).map((size) => (
          <Progress key={`${tone}-${size}`} {...args} tone={tone} size={size} />
        ))
      )}
      <div className="flex items-center gap-inline">
        <Progress {...args} value={62} className="flex-1" />
        <span className="font-mono tabular-nums">62%</span>
      </div>
    </div>
  ),
};
