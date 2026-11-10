import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Field } from '../../field';
import { TagInput } from '../tag-input';

const meta = {
  title: 'Primitives/TagInput',
  component: TagInput,
  args: { value: [], onValueChange: () => {} },
} satisfies Meta<typeof TagInput>;

export default meta;

type Story = StoryObj<typeof meta>;

function Controlled({ initial, max }: { initial: string[]; max?: number }) {
  const [tags, setTags] = useState(initial);

  return (
    <Field.Root className="w-96">
      <Field.Label>Blocked words</Field.Label>
      <TagInput value={tags} onValueChange={setTags} max={max} placeholder="Add a word" />
    </Field.Root>
  );
}

export const Empty: Story = { render: () => <Controlled initial={[]} /> };

export const WithTags: Story = {
  render: () => <Controlled initial={['spoiler', 'giveaway', 'follow me']} />,
};

export const AtItsLimit: Story = {
  render: () => <Controlled initial={['spoiler', 'giveaway']} max={2} />,
};
