import type { Meta, StoryObj } from '@storybook/react-vite';
import { PLATFORM_ICON_NAMES, PlatformIcon } from '../platform-icon';

const meta = {
  title: 'Primitives/PlatformIcon',
  component: PlatformIcon,
  args: { platform: 'github' },
} satisfies Meta<typeof PlatformIcon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EveryPlatform: Story = {
  render: (args) => (
    <div className="flex flex-wrap gap-inline">
      {PLATFORM_ICON_NAMES.map((platform) => (
        <PlatformIcon key={platform} {...args} platform={platform} size="lg" />
      ))}
    </div>
  ),
};
