import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { DropdownMenu, Icon } from '@vp/ui';
import { EngagementBar, EngagementBarSkeleton } from '.';
import { EngagementBarRoot } from './engagement-bar';
import type { EngagementBarReaction } from './types';

const AVATAR = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="#8a3d17"/></svg>'
)}`;

interface BarState {
  subscribed?: boolean;
  pending?: boolean;
  reaction?: EngagementBarReaction;
  likes?: string;
  name?: string;
  subscribers?: string;
  saved?: boolean;
  overflowOpen?: boolean;
}

function Bar({
  subscribed = false,
  pending = false,
  reaction = null,
  likes = '24K',
  name = 'Marta Reis Films',
  subscribers = '284K subscribers',
  saved = false,
  overflowOpen,
}: BarState) {
  return (
    <>
      <EngagementBar.Channel name={name} avatarSrc={AVATAR} subscribers={subscribers} asChild>
        {/* biome-ignore lint/a11y/useAnchorContent: the kit draws the content into the link */}
        <a href="/channel/marta" />
      </EngagementBar.Channel>
      <EngagementBar.Subscribe subscribed={subscribed} pending={pending} onToggle={() => undefined}>
        {subscribed ? 'Subscribed' : 'Subscribe'}
      </EngagementBar.Subscribe>
      <EngagementBar.Actions>
        <EngagementBar.Reaction value={reaction} likes={likes} onChange={() => undefined} />
        <EngagementBar.Action icon="share">Share</EngagementBar.Action>
        <EngagementBar.Action icon="save" pressed={saved}>
          {saved ? 'Saved' : 'Save'}
        </EngagementBar.Action>
        <EngagementBar.Action icon="queue-add">Queue</EngagementBar.Action>
        <EngagementBar.Overflow open={overflowOpen} modal={overflowOpen ? false : undefined}>
          <DropdownMenu.Item>
            <Icon name="clip" />
            Clip
          </DropdownMenu.Item>
          <DropdownMenu.Item>
            <Icon name="alert" />
            Report
          </DropdownMenu.Item>
        </EngagementBar.Overflow>
      </EngagementBar.Actions>
    </>
  );
}

const frame: Decorator = (Story) => (
  <div className="tw:p-section">
    <Story />
  </div>
);

const meta = {
  title: 'Web/EngagementBar',
  component: EngagementBarRoot,
  decorators: [frame],
} satisfies Meta<typeof EngagementBarRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SignedInNotSubscribed: Story = {
  render: (args) => (
    <EngagementBar.Root {...args}>
      <Bar />
    </EngagementBar.Root>
  ),
};

export const SubscribedAndLiked: Story = {
  render: (args) => (
    <EngagementBar.Root {...args}>
      <Bar subscribed reaction="LIKE" likes="24K" saved />
    </EngagementBar.Root>
  ),
};

export const Disliked: Story = {
  render: (args) => (
    <EngagementBar.Root {...args}>
      <Bar reaction="DISLIKE" />
    </EngagementBar.Root>
  ),
};

export const PendingSubscribe: Story = {
  render: (args) => (
    <EngagementBar.Root {...args}>
      <Bar subscribed pending reaction="LIKE" likes="24K" />
    </EngagementBar.Root>
  ),
};

export const LongNameAndLargeCounts: Story = {
  render: (args) => (
    <EngagementBar.Root {...args}>
      <Bar
        name="Marta Reis Films and the Lisbon Night Tram Collective"
        subscribers="1.2M subscribers"
        likes="1.2M"
      />
    </EngagementBar.Root>
  ),
};

export const Bar_: Story = {
  name: 'Bar',
  args: { layout: 'bar' },
  render: SignedInNotSubscribed.render,
};

export const StackedIconOnly: Story = {
  args: { layout: 'stacked' },
  globals: { viewport: { value: 'mobile1' } },
  render: SignedInNotSubscribed.render,
};

export const OverflowOpen: Story = {
  render: (args) => (
    <EngagementBar.Root {...args}>
      <Bar overflowOpen />
    </EngagementBar.Root>
  ),
};

export const SignedOut: Story = {
  render: SignedInNotSubscribed.render,
};

export const RightToLeft: Story = {
  decorators: [
    (Story) => (
      <div dir="rtl">
        <Story />
      </div>
    ),
  ],
  render: SignedInNotSubscribed.render,
};

export const Skeleton: Story = {
  render: () => <EngagementBarSkeleton />,
};
