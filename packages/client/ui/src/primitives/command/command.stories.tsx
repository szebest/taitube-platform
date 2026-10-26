import type { Meta, StoryObj } from '@storybook/react-vite';
import { Kbd } from '../kbd';
import { Command } from '.';
import { CommandRoot } from './command';

const meta = {
  title: 'Primitives/Command',
  component: CommandRoot,
} satisfies Meta<typeof CommandRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

const Palette = (props: { variant: 'inline' | 'palette'; size: 'sm' | 'md'; search?: string }) => (
  <Command.Root aria-label="Search and actions" className="tw:m-section tw:max-w-md" {...props}>
    <Command.Input placeholder="Type a command or search" defaultValue={props.search} />
    <Command.List>
      <Command.Empty />
      <Command.Group heading="Actions">
        <Command.Item value="theme">
          Switch theme
          <Command.Shortcut>
            <Kbd size="sm">T</Kbd>
          </Command.Shortcut>
        </Command.Item>
        <Command.Item value="queue">Open the queue</Command.Item>
        <Command.Item value="locked" disabled>
          Locked
        </Command.Item>
      </Command.Group>
      <Command.Group heading="Videos">
        <Command.Item value="lisbon">Lisbon at night</Command.Item>
      </Command.Group>
    </Command.List>
  </Command.Root>
);

export const Inline: Story = { render: () => <Palette variant="inline" size="md" /> };

export const PaletteSmall: Story = { render: () => <Palette variant="palette" size="sm" /> };
