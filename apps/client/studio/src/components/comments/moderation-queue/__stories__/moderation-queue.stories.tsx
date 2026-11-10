import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ModerationQueue } from '../index';

const meta = {
  title: 'Studio/ModerationQueue',
  component: ModerationQueue.Root,
  args: { active: 'b', onActiveChange: () => {}, selected: new Set<string>() },
} satisfies Meta<typeof ModerationQueue.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

const COMMENTS = [
  { id: 'a', author: 'Marta', text: 'Where was this filmed? The light is perfect.' },
  { id: 'b', author: 'Tomek', text: 'Check out my channel for more like this' },
  { id: 'c', author: 'Ines', text: 'The second verse is a bit flat, honestly.' },
];

function Queue({ selected }: { selected: string[] }) {
  const [active, setActive] = useState<string>('b');

  return (
    <ModerationQueue.Root
      aria-label="Held comments"
      active={active}
      onActiveChange={setActive}
      selected={new Set(selected)}
      className="w-96"
    >
      {COMMENTS.map(({ id, author, text }) => (
        <ModerationQueue.Item key={id} value={id}>
          <span className="text-label">{author}</span>
          <span className="line-clamp-2 text-body-sm text-fg-muted">{text}</span>
        </ModerationQueue.Item>
      ))}
    </ModerationQueue.Root>
  );
}

export const OneActive: Story = { render: () => <Queue selected={[]} /> };

export const WithSelection: Story = { render: () => <Queue selected={['a', 'c']} /> };
