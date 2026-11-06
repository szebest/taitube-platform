import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../lib/variant-names';
import { Separator } from './separator';
import { separatorStyles } from './separator.variants';

const meta = {
  title: 'Primitives/Separator',
  component: Separator,
} satisfies Meta<typeof Separator>;

export default meta;

type Story = StoryObj<typeof meta>;

const GROUNDS = ['bg-bg', 'bg-surface', 'bg-raised'];

export const TonesOnEveryGround: Story = {
  render: (args) => (
    <div className="flex flex-col gap-stack">
      {GROUNDS.map((ground) => (
        <div key={ground} className={`flex flex-col gap-stack p-inset-card text-fg ${ground}`}>
          {variantNames(separatorStyles.variants.tone).map((tone) => (
            <div key={tone} className="flex flex-col gap-inline">
              <span className="text-body-sm">{tone}</span>
              <Separator {...args} tone={tone} />
              <div className="flex h-control-md items-center gap-inline">
                <span>Group one</span>
                <Separator {...args} tone={tone} orientation="vertical" />
                <span>Group two</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
};
