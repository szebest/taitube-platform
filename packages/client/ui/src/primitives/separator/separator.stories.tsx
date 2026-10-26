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

const GROUNDS = ['tw:bg-bg', 'tw:bg-surface', 'tw:bg-raised'];

export const TonesOnEveryGround: Story = {
  render: (args) => (
    <div className="tw:flex tw:flex-col tw:gap-stack">
      {GROUNDS.map((ground) => (
        <div
          key={ground}
          className={`tw:flex tw:flex-col tw:gap-stack tw:p-inset-card tw:text-fg ${ground}`}
        >
          {variantNames(separatorStyles.variants.tone).map((tone) => (
            <div key={tone} className="tw:flex tw:flex-col tw:gap-inline">
              <span className="tw:text-body-sm">{tone}</span>
              <Separator {...args} tone={tone} />
              <div className="tw:flex tw:h-control-md tw:items-center tw:gap-inline">
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
