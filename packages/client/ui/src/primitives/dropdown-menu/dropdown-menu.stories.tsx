import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../lib/variant-names';
import { Icon } from '../icon';
import { IconButton } from '../icon-button';
import { Kbd } from '../kbd';
import { DropdownMenu } from '.';
import { DropdownMenuContent } from './dropdown-menu';
import { menuStyles } from './dropdown-menu.variants';

const meta = {
  title: 'Primitives/DropdownMenu',
  component: DropdownMenuContent,
  tags: ['motion'],
} satisfies Meta<typeof DropdownMenuContent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Sizes: Story = {
  render: (args) => (
    <div className="tw:flex tw:gap-60 tw:p-section">
      {variantNames(menuStyles.variants.size).map((size) => (
        <DropdownMenu.Root key={size} open modal={false}>
          <DropdownMenu.Trigger asChild>
            <IconButton aria-label={`More ${size}`}>
              <Icon name="more" />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content {...args} size={size}>
            <DropdownMenu.Label>Video</DropdownMenu.Label>
            <DropdownMenu.Item>
              <Icon name="queue-add" />
              Add to queue
              <DropdownMenu.Shortcut>
                <Kbd size="sm">Q</Kbd>
              </DropdownMenu.Shortcut>
            </DropdownMenu.Item>
            <DropdownMenu.CheckboxItem checked>Captions</DropdownMenu.CheckboxItem>
            <DropdownMenu.RadioGroup value="auto">
              <DropdownMenu.RadioItem value="auto">Auto</DropdownMenu.RadioItem>
              <DropdownMenu.RadioItem value="1080p">1080p</DropdownMenu.RadioItem>
            </DropdownMenu.RadioGroup>
            <DropdownMenu.Item disabled>Download</DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item tone="danger">
              <Icon name="trash" />
              Remove
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      ))}
    </div>
  ),
};

export const OpensAtOnceFromTheKeyboard: Story = {
  render: () => (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <IconButton aria-label="More">
          <Icon name="more" />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item>Add to queue</DropdownMenu.Item>
        <DropdownMenu.Item>Share</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  ),
  play: async ({ canvas, userEvent }) => {
    canvas.getByRole('button', { name: 'More' }).focus();
    await userEvent.keyboard('{Enter}');

    const menu = document.querySelector('[data-slot="dropdown-menu-content"][data-state="open"]');
    if (menu === null || menu.getAnimations().length > 0) {
      throw new Error('a menu opened from the keyboard animated its open');
    }
  },
};
