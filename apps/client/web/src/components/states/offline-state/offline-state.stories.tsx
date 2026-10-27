import type { Meta, StoryObj } from '@storybook/react-vite';
import { OfflineState } from '.';
import { OfflineStateRoot, type OfflineStateRootProps } from './offline-state';

const retry: OfflineStateRootProps['onRetry'] = () => undefined;

const meta = {
  title: 'Web/OfflineState',
  component: OfflineStateRoot,
  args: { size: 'page', tone: 'neutral', onRetry: retry },
} satisfies Meta<typeof OfflineStateRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

interface Content {
  description?: string;
  available?: boolean;
}

function renderOffline(
  args: OfflineStateRootProps,
  { description = 'Saved videos and your queue still work.', available = true }: Content = {}
) {
  return (
    <OfflineState.Root {...args}>
      <OfflineState.Title asChild>
        <h2>You are offline</h2>
      </OfflineState.Title>
      <OfflineState.Description>{description}</OfflineState.Description>
      {available && (
        <OfflineState.Available>
          <OfflineState.Link href="/feed/watch-later" count="6 videos">
            Watch later
          </OfflineState.Link>
          <OfflineState.Link href="/you/downloads" count="2 videos">
            Downloads
          </OfflineState.Link>
        </OfflineState.Available>
      )}
      {available && (
        <OfflineState.Action asChild>
          <a href="/you/downloads">Open Downloads</a>
        </OfflineState.Action>
      )}
    </OfflineState.Root>
  );
}

export const PageWithTwoAvailableLists: Story = { render: (args) => renderOffline(args) };

export const Banner: Story = { args: { size: 'banner' }, render: (args) => renderOffline(args) };

export const SectionInPlaceOfComments: Story = {
  args: { size: 'section' },
  render: (args) =>
    renderOffline(args, {
      description: 'Comments need a connection. Your saved videos still play.',
    }),
};

export const StillOfflineWithLastOnlineTime: Story = {
  render: (args) =>
    renderOffline(args, {
      description: 'Saved videos and your queue still work. Last online 4 minutes ago.',
    }),
};

export const NothingAvailable: Story = {
  render: (args) =>
    renderOffline(args, {
      description: 'Nothing is saved on this device yet, so there is nothing to watch offline.',
      available: false,
    }),
};

export const Reconnected: Story = {
  args: { size: 'banner', tone: 'success' },
  render: (args) => (
    <OfflineState.Root {...args}>
      <OfflineState.Reconnected />
    </OfflineState.Root>
  ),
};

export const WithQueuedChanges: Story = {
  render: (args) =>
    renderOffline(args, {
      description:
        'Saved videos and your queue still work. 3 changes will sync when you are back online.',
    }),
};

export const Checking: Story = {
  args: { onRetry: () => new Promise<void>(() => undefined) },
  render: (args) => renderOffline(args),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }));
  },
};

export const CompactBanner: Story = {
  args: { size: 'banner' },
  render: (args) => <div className="tw:max-w-[23.4375rem]">{renderOffline(args)}</div>,
};

export const RightToLeft: Story = {
  globals: { direction: 'rtl' },
  render: (args) => renderOffline(args),
};
