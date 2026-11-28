import { DropdownMenu, IconButton, Icon } from '@kit/ui';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { WatchTogetherMenuItem } from '..';

const VIDEO_ID = '0190c3a0-5e1d-7000-8000-00000000a001';

const meta = {
  title: 'Web/WatchTogetherMenuItem',
  tags: ['text', 'translated'],
  component: WatchTogetherMenuItem,
  args: { videoId: VIDEO_ID },
  parameters: { app: { session: 'signed-in' } },
  render: (args) => (
    <div className="p-section">
      <DropdownMenu.Root open>
        <DropdownMenu.Trigger asChild>
          <IconButton aria-label="More">
            <Icon name="more" />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <WatchTogetherMenuItem {...args} />
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  ),
} satisfies Meta<typeof WatchTogetherMenuItem>;

export default meta;

type Story = StoryObj<typeof meta>;

export const InAMenu: Story = {};
