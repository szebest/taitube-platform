import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { FieldDialog, type FieldDialogProps } from '../field-dialog';

const meta = {
  title: 'Studio/FieldDialog',
  component: FieldDialog,
  args: {
    open: true,
    onOpenChange: () => undefined,
    onSubmit: () => undefined,
    title: 'Change visibility',
    description: 'Applies to 3 selected videos.',
    label: 'Visibility',
    submitLabel: 'Apply',
    input: {
      kind: 'choice',
      options: [
        { value: 'public', label: 'Public' },
        { value: 'unlisted', label: 'Unlisted' },
        { value: 'private', label: 'Private' },
      ],
    },
  },
} satisfies Meta<typeof FieldDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

function Opened(props: Partial<FieldDialogProps>) {
  const [open, setOpen] = useState(true);

  return (
    <FieldDialog
      title="Add tags"
      label="Tags to add"
      submitLabel="Apply"
      input={{ kind: 'text', hint: 'Separate tags with commas.' }}
      onSubmit={() => setOpen(false)}
      {...props}
      open={open}
      onOpenChange={setOpen}
    />
  );
}

export const Choice: Story = {};

export const Text: Story = {
  render: () => <Opened />,
};

export const Pending: Story = {
  render: () => <Opened pending />,
};
