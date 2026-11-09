import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { isSubscribedToChannel } from '@vp/api-contracts';
import { ChannelRow } from '..';

const CHANNEL_ID = '0190c3a0-5e1d-7000-8000-00000000c001';

const AVATAR = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="#8a3d17"/></svg>'
)}`;

const CHANNEL = {
  id: CHANNEL_ID,
  displayName: 'Marta Reis Films',
  handle: 'martareis',
  avatarUrl: AVATAR,
  subscriberCount: 284_000,
};

const subscription = (subscribed: boolean) => ({
  session: 'signed-in' as const,
  api: () => [
    {
      contract: isSubscribedToChannel,
      body: () => ({ channelId: CHANNEL_ID, subscribed }),
    },
  ],
});

const frame: Decorator = (Story) => (
  <div className="max-w-[48rem] p-section">
    <Story />
  </div>
);

const meta = {
  title: 'Web/ChannelRow',
  tags: ['text', 'translated'],
  component: ChannelRow,
  args: { channel: CHANNEL },
  parameters: { app: {} },
  decorators: [frame],
} satisfies Meta<typeof ChannelRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Guest: Story = {};

export const SignedInNotSubscribed: Story = {
  parameters: { app: subscription(false) },
};

export const Subscribed: Story = {
  parameters: { app: subscription(true) },
};

export const WithBio: Story = {
  args: {
    bio: (
      <>
        Short films shot on tape, mostly at night. <mark>Trams</mark>, rain on tiles and the people
        still out when the city goes quiet.
      </>
    ),
  },
};

export const NoAvatar: Story = {
  args: { channel: { ...CHANNEL, avatarUrl: null } },
};

export const LongNameAndLargeCount: Story = {
  args: {
    channel: {
      ...CHANNEL,
      displayName:
        'The Extremely Patient Society for Night Trams, Wet Tiles and Other Quiet Things',
      handle: 'theextremelypatientsocietyfornighttrams',
      subscriberCount: 12_400_000,
    },
  },
};

export const Narrow: Story = {
  globals: { viewport: { value: 'mobile1' } },
};

export const RightToLeft: Story = {
  globals: { direction: 'rtl' },
};
