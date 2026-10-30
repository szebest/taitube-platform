import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { ChoiceCards } from '.';
import { ChoiceCardsRoot } from './choice-cards';

const meta = {
  title: 'Web/ChoiceCards',
  component: ChoiceCardsRoot,
} satisfies Meta<typeof ChoiceCardsRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

const OPTIONS = ['Sharp', 'Soft', 'Round'];

function Cards({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);

  return (
    <ChoiceCards.Root aria-label="Corners" value={value} onValueChange={setValue}>
      {OPTIONS.map((option) => (
        <ChoiceCards.Option key={option} value={option}>
          <ChoiceCards.Preview>
            <div className="tw:h-10 tw:rounded-card tw:bg-tint-strong" />
          </ChoiceCards.Preview>
          <ChoiceCards.Label>{option}</ChoiceCards.Label>
        </ChoiceCards.Option>
      ))}
    </ChoiceCards.Root>
  );
}

export const Default: Story = {
  args: { value: 'Soft', onValueChange: () => undefined },
  render: () => <Cards initial="Soft" />,
};

export const FirstSelected: Story = {
  args: { value: 'Sharp', onValueChange: () => undefined },
  render: () => <Cards initial="Sharp" />,
};
