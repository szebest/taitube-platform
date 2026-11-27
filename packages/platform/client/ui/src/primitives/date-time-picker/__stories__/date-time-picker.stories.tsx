import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { DateTimePicker } from '..';
import { Field } from '../../field';

const meta = {
  title: 'Primitives/DateTimePicker',
  tags: ['text'],
  component: DateTimePicker,
  args: {
    value: '',
    onValueChange: () => undefined,
    dateLabel: 'Date',
    timeLabel: 'Time',
  },
} satisfies Meta<typeof DateTimePicker>;

export default meta;

type Story = StoryObj<typeof meta>;

function Controlled({ initial, ...args }: Story['args'] & { initial: string }) {
  const [value, setValue] = useState(initial);

  return (
    <DateTimePicker
      dateLabel="Date"
      timeLabel="Time"
      {...args}
      value={value}
      onValueChange={setValue}
    />
  );
}

export const EmptyAndFilled: Story = {
  render: () => (
    <div className="flex flex-col gap-stack">
      <Controlled initial="" />
      <Controlled initial="2026-12-24T18:30" />
    </div>
  ),
};

export const InAField: Story = {
  render: () => (
    <Field.Root>
      <Field.Label>Publish at</Field.Label>
      <Controlled initial="2026-12-24T18:30" min="2026-12-01T00:00" />
      <Field.Hint>Local time, in the future.</Field.Hint>
    </Field.Root>
  ),
};

export const Disabled: Story = {
  render: () => <Controlled initial="2026-12-24T18:30" disabled />,
};
