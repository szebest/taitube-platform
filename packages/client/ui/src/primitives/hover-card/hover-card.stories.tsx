import type { Meta, StoryObj } from '@storybook/react-vite';
import { HoverCard } from '.';
import { HoverCardContent } from './hover-card';

const meta = {
  title: 'Primitives/HoverCard',
  component: HoverCardContent,
  tags: ['motion'],
} satisfies Meta<typeof HoverCardContent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ChannelPreview: Story = {
  render: (args) => (
    <div className="tw:p-section">
      <HoverCard.Root open>
        <HoverCard.Trigger asChild>
          <a href="/channel/marta-reis">@marta-reis</a>
        </HoverCard.Trigger>
        <HoverCard.Content {...args} size="sm">
          <HoverCard.Arrow />
          <p className="tw:m-0 tw:text-title">Marta Reis Films</p>
          <p className="tw:m-0 tw:text-fg-muted">284K followers</p>
        </HoverCard.Content>
      </HoverCard.Root>
    </div>
  ),
};
