import type { Meta, StoryObj } from '@storybook/react-vite';
import { GoalBarBar, GoalBarCount, GoalBarLabel, GoalBarRoot } from './goal-bar';

const meta = {
  title: 'Studio/GoalBar',
  component: GoalBarRoot,
  args: { className: 'tw:w-[24rem]' },
  render: (args) => (
    <GoalBarRoot {...args}>
      <GoalBarLabel>Subscriber goal</GoalBarLabel>
      <GoalBarCount>12 of 25</GoalBarCount>
      <GoalBarBar aria-label="Subscriber goal" value={12} max={25} />
    </GoalBarRoot>
  ),
} satisfies Meta<typeof GoalBarRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Started: Story = {};

export const Empty: Story = {
  render: (args) => (
    <GoalBarRoot {...args}>
      <GoalBarLabel>Subscriber goal</GoalBarLabel>
      <GoalBarCount>0 of 10</GoalBarCount>
      <GoalBarBar aria-label="Subscriber goal" value={0} max={10} />
    </GoalBarRoot>
  ),
};

export const AlmostThere: Story = {
  render: (args) => (
    <GoalBarRoot {...args}>
      <GoalBarLabel>Subscriber goal</GoalBarLabel>
      <GoalBarCount>999 of 1,000</GoalBarCount>
      <GoalBarBar aria-label="Subscriber goal" value={999} max={1000} />
    </GoalBarRoot>
  ),
};
