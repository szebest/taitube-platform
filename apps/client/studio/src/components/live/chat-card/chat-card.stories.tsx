import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChatCard } from './index';

const meta = {
  title: 'Studio/ChatCard',
  component: ChatCard.Root,
  args: { className: 'w-[22rem]' },
  render: (args) => (
    <ChatCard.Root {...args}>
      <ChatCard.Author>Mira</ChatCard.Author>
      <ChatCard.Text>Great stream today!</ChatCard.Text>
    </ChatCard.Root>
  ),
} satisfies Meta<typeof ChatCard.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ShortLine: Story = {};

export const LongLine: Story = {
  render: (args) => (
    <ChatCard.Root {...args}>
      <ChatCard.Author>Mira</ChatCard.Author>
      <ChatCard.Text>
        A very long message that keeps going and going so that the card has to wrap it over several
        lines without growing past its width, including a verylongunbrokenwordthatmustbreak.
      </ChatCard.Text>
    </ChatCard.Root>
  ),
};
