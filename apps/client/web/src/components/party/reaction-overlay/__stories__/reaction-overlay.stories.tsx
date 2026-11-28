import type { Meta, StoryObj } from '@storybook/react-vite';
import { PartyPermissionsProvider } from '@vp/permissions-react';
import { withPartyIntl } from '#app/__tests__/with-party-intl';
import { ReactionOverlay } from '..';
import { ReactionOverlayRoot } from '../reaction-overlay';

const meta = {
  title: 'Web/ReactionOverlay',
  decorators: [withPartyIntl],
  component: ReactionOverlayRoot,
} satisfies Meta<typeof ReactionOverlayRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

const stage = 'relative h-64 w-[26rem] rounded-card bg-surface';

export const Bursts: Story = {
  render: (args) => (
    <div className={stage}>
      <ReactionOverlay.Root {...args}>
        <ReactionOverlay.Burst emoji="🔥" at={20} />
        <ReactionOverlay.Burst emoji="🎉" at={55} />
        <ReactionOverlay.Burst emoji="😍" at={80} />
      </ReactionOverlay.Root>
    </div>
  ),
};

export const ReducedMotionChips: Story = {
  render: (args) => (
    <div className={stage}>
      <ReactionOverlay.Root {...args}>
        <ReactionOverlay.Chip emoji="🔥" count={5} />
        <ReactionOverlay.Chip emoji="🎉" count={2} />
      </ReactionOverlay.Root>
    </div>
  ),
};

export const Bar: Story = {
  render: () => (
    <PartyPermissionsProvider
      userContext={null}
      viewer={{ permissions: ['chat.react'], topPosition: 20, isOwner: false, kind: 'user' }}
    >
      <ReactionOverlay.Bar
        emojis={['😂', '😮', '😍', '👏', '🔥', '😢', '😱', '🎉']}
        onReact={() => undefined}
      />
    </PartyPermissionsProvider>
  ),
};
