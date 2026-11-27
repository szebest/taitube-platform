import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { waitFor } from '@testing-library/dom';
import { isSubscribedToChannel, subscribeToChannel } from '@vp/api-contracts';
import { ChannelHeader } from '#app/components/channel/channel-header';
import { SubscribeAction } from '..';

const CHANNEL_ID = '0190c3a0-5e1d-7000-8000-00000000c001';

const status = (subscribed: boolean) => ({ channelId: CHANNEL_ID, subscribed });

const subscription = (initially: boolean) => () => {
  let subscribed = initially;
  return [
    { contract: isSubscribedToChannel, body: () => status(subscribed) },
    {
      contract: subscribeToChannel,
      body: () => {
        subscribed = true;
        return { ...status(true), subscriberCount: 284_001 };
      },
    },
  ];
};

const BUSY = '[aria-busy="true"]';

const isBusy = (root: HTMLElement, busy: boolean) =>
  waitFor(() => {
    if ((root.querySelector(BUSY) !== null) !== busy) throw new Error('not there yet');
  });

const inHeader: Decorator = (Story) => (
  <div className="p-section">
    <ChannelHeader.Root layout="identity">
      <ChannelHeader.Actions>
        <Story />
      </ChannelHeader.Actions>
    </ChannelHeader.Root>
  </div>
);

const meta = {
  title: 'Web/SubscribeAction',
  tags: ['text', 'translated'],
  component: SubscribeAction,
  args: { channelId: CHANNEL_ID },
  parameters: { app: { session: 'signed-in', api: subscription(false) } },
  decorators: [inHeader],
} satisfies Meta<typeof SubscribeAction>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NotSubscribed: Story = {};

export const Subscribed: Story = {
  parameters: { app: { session: 'signed-in', api: subscription(true) } },
};

export const Guest: Story = {
  parameters: { app: { session: 'guest' } },
};

export const Pending: Story = {
  tags: ['motion'],
  parameters: {
    app: {
      session: 'signed-in',
      api: () => [
        { contract: isSubscribedToChannel, body: () => status(false) },
        { contract: subscribeToChannel, body: () => new Promise(() => undefined) },
      ],
    },
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { pressed: false }));
    await isBusy(canvasElement, true);
  },
};

export const Subscribing: Story = {
  tags: ['motion'],
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { pressed: false }));
    await canvas.findByRole('button', { pressed: true });
    await isBusy(canvasElement, false);
  },
};

export const RightToLeft: Story = {
  globals: { direction: 'rtl' },
};
