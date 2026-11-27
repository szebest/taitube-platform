import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ApiScope } from '@vp/domain';
import { useState } from 'react';
import { ScopePicker } from '../index';

const GROUPS: { title: string; items: [ApiScope, string][] }[] = [
  {
    title: 'Videos',
    items: [
      ['videos:read', 'Read your videos and their metadata'],
      ['videos:write', 'Edit titles, chapters, visibility and tags'],
    ],
  },
  { title: 'Analytics', items: [['analytics:read', 'Read views and watch time']] },
  {
    title: 'Comments',
    items: [
      ['comments:read', 'Read comments on your videos'],
      ['comments:moderate', 'Hold, hide and approve comments'],
    ],
  },
];

function Picker({ initial, disabled }: { initial: ApiScope[]; disabled?: boolean }) {
  const [value, setValue] = useState(initial);

  return (
    <ScopePicker.Root
      value={value}
      onValueChange={setValue}
      disabled={disabled}
      className="w-[28rem] max-w-full"
    >
      <ScopePicker.Legend>What the token may do</ScopePicker.Legend>
      {GROUPS.map(({ title, items }) => (
        <ScopePicker.Group key={title}>
          <ScopePicker.GroupTitle>{title}</ScopePicker.GroupTitle>
          {items.map(([scope, label]) => (
            <ScopePicker.Item key={scope} scope={scope}>
              {label}
            </ScopePicker.Item>
          ))}
        </ScopePicker.Group>
      ))}
    </ScopePicker.Root>
  );
}

const meta = {
  title: 'Studio/ScopePicker',
  component: Picker,
  args: { initial: [] },
} satisfies Meta<typeof Picker>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const SomeChosen: Story = { args: { initial: ['videos:read', 'analytics:read'] } };

export const Disabled: Story = { args: { initial: ['comments:read'], disabled: true } };
