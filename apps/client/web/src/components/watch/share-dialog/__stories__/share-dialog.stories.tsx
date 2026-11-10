import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { screen } from '@testing-library/dom';
import { Dialog } from '@vp/ui';
import { ShareDialog, ShareDialogContent } from '..';

const VIDEO_ID = '0190c3a0-5e1d-7000-8000-00000000a001';

const padded: Decorator = (Story) => (
  <div className="p-section">
    <Story />
  </div>
);

const meta = {
  title: 'Web/ShareDialog',
  tags: ['text', 'translated'],
  component: ShareDialog,
  args: { video: { id: VIDEO_ID } },
  parameters: { app: {}, layout: 'fullscreen' },
  decorators: [padded],
} satisfies Meta<typeof ShareDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Trigger: Story = {};

export const Opened: Story = {
  tags: ['motion'],
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button'));
    await screen.findByRole('dialog');
  },
};

export const LinkOnly: Story = {
  render: () => (
    <Dialog.Root open>
      <ShareDialogContent videoId={VIDEO_ID} startAt={0} />
    </Dialog.Root>
  ),
};

export const WithStartAtOption: Story = {
  render: () => (
    <Dialog.Root open>
      <ShareDialogContent videoId={VIDEO_ID} startAt={83} />
    </Dialog.Root>
  ),
};

export const StartAtChosen: Story = {
  tags: ['motion'],
  render: WithStartAtOption.render,
  play: async ({ userEvent }) => {
    await userEvent.click(await screen.findByRole('checkbox'));
  },
};

export const RightToLeft: Story = {
  globals: { direction: 'rtl' },
  render: WithStartAtOption.render,
};
