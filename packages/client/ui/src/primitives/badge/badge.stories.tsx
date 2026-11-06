import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../lib/variant-names';
import { Icon } from '../icon';
import { Badge } from './badge';
import { badgeStyles } from './badge.variants';

const meta = {
  title: 'Primitives/Badge',
  component: Badge,
  tags: ['motion', 'text'],
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FillsAndTones: Story = {
  render: (args) => (
    <div className="grid w-fit grid-cols-7 gap-inline">
      {variantNames(badgeStyles.variants.variant).flatMap((variant) =>
        variantNames(badgeStyles.variants.tone).map((tone) => (
          <Badge key={`${variant}-${tone}`} {...args} variant={variant} tone={tone}>
            {tone}
          </Badge>
        ))
      )}
    </div>
  ),
};

export const InContext: Story = {
  render: (args) => (
    <div className="flex items-start gap-stack">
      <div className="relative aspect-video w-60 rounded-thumb bg-media">
        <Badge {...args} variant="scrim" className="absolute end-2 bottom-2">
          4K
        </Badge>
        <Badge {...args} tone="live" className="absolute start-2 top-2">
          Live
        </Badge>
      </div>
      <div className="flex flex-col items-start gap-inline">
        <Badge {...args} tone="success" size="sm">
          <Icon name="check" />
          Ready
        </Badge>
        <Badge {...args} tone="warning" size="sm">
          <Icon name="alert" />
          Processing slowly
        </Badge>
        <Badge {...args} variant="outline" size="sm">
          1,204
        </Badge>
        <Badge {...args} className="max-w-24">
          A label too long to fit its slot
        </Badge>
      </div>
    </div>
  ),
};
