import type { Meta, StoryObj } from '@storybook/react-vite';
import { ThreadPanel } from '..';
import { ThreadPanelRoot } from '../thread-panel';

const meta = {
  title: 'Web/ThreadPanel',
  tags: ['text', 'translated'],
  component: ThreadPanelRoot,
  args: { open: true, onOpenChange: () => undefined, onSeek: () => undefined, children: null },
  parameters: { app: {}, layout: 'fullscreen' },
} satisfies Meta<typeof ThreadPanelRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithReplies: Story = {
  render: (args) => (
    <ThreadPanel.Root {...args}>
      <ThreadPanel.Header>
        <ThreadPanel.Title>The twist at the tram</ThreadPanel.Title>
        <ThreadPanel.Anchor seconds={65} time="01:05" />
      </ThreadPanel.Header>
      <ThreadPanel.Body>Did anyone catch the second sign on the left?</ThreadPanel.Body>
      <ThreadPanel.Replies>
        <p className="m-0 text-body">Yes, the green one.</p>
        <p className="m-0 text-body">No idea, I was watching the rain.</p>
      </ThreadPanel.Replies>
      <ThreadPanel.Composer>
        <textarea aria-label="Reply" className="min-h-16 w-full" />
      </ThreadPanel.Composer>
    </ThreadPanel.Root>
  ),
};

export const WithoutText: Story = {
  render: (args) => (
    <ThreadPanel.Root {...args}>
      <ThreadPanel.Header>
        <ThreadPanel.Title>Is this the same tram as before?</ThreadPanel.Title>
        <ThreadPanel.Anchor seconds={3725} time="1:02:05" />
      </ThreadPanel.Header>
      <ThreadPanel.Replies>
        <p className="m-0 text-body">Replies show here.</p>
      </ThreadPanel.Replies>
    </ThreadPanel.Root>
  ),
};
