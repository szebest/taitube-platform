import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { DisclosureControl } from '../disclosure-control';
import type { DisclosureOption } from '../types';

const meta = {
  title: 'Components/DisclosureControl',
  component: DisclosureControl,
  tags: ['motion', 'text'],
  args: { value: 'silent', onValueChange: () => undefined },
} satisfies Meta<typeof DisclosureControl>;

export default meta;

type Story = StoryObj<typeof meta>;

function Controlled({ initial, ...props }: { initial: DisclosureOption; size?: 'sm' | 'md' }) {
  const [value, setValue] = useState(initial);

  return <DisclosureControl {...props} value={value} onValueChange={setValue} />;
}

export const Silent: Story = {
  render: () => <Controlled initial="silent" />,
};

export const Visible: Story = {
  render: () => <Controlled initial="visible" />,
};

export const Small: Story = {
  render: () => <Controlled initial="visible" size="sm" />,
};

export const Disabled: Story = {
  args: { value: 'visible', disabled: true },
};

export const Flips: Story = {
  render: () => <Controlled initial="silent" />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('radio', { name: 'Visible' }));

    if (
      !canvas
        .getByRole('radio', { name: 'Visible' })
        .getAttribute('data-state')
        ?.includes('checked')
    ) {
      throw new Error('Visible was not picked');
    }
  },
};
