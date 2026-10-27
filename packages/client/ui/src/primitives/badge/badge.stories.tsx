import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../lib/variant-names';
import { Icon } from '../icon';
import { Badge } from './badge';
import { badgeStyles } from './badge.variants';

const meta = {
  title: 'Primitives/Badge',
  component: Badge,
  tags: ['motion'],
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FillsAndTones: Story = {
  render: (args) => (
    <div className="tw:grid tw:w-fit tw:grid-cols-7 tw:gap-inline">
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
    <div className="tw:flex tw:items-start tw:gap-stack">
      <div className="tw:relative tw:aspect-video tw:w-60 tw:rounded-thumb tw:bg-media">
        <Badge {...args} variant="scrim" className="tw:absolute tw:end-2 tw:bottom-2">
          4K
        </Badge>
        <Badge {...args} tone="live" className="tw:absolute tw:start-2 tw:top-2">
          Live
        </Badge>
      </div>
      <div className="tw:flex tw:flex-col tw:items-start tw:gap-inline">
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
        <Badge {...args} className="tw:max-w-24">
          A label too long to fit its slot
        </Badge>
      </div>
    </div>
  ),
};
