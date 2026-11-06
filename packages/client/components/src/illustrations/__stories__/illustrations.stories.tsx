import type { Meta, StoryObj } from '@storybook/react-vite';
import * as illustrations from '..';

const meta = {
  title: 'Components/Illustrations',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const All: Story = {
  render: () => (
    <div className="grid grid-cols-4 gap-stack text-accent">
      {Object.entries(illustrations).map(([name, Drawing]) => (
        <figure key={name} className="m-0 flex flex-col items-center gap-inline">
          <Drawing className="w-40" />
          <figcaption className="text-caption text-fg-muted">{name}</figcaption>
        </figure>
      ))}
    </div>
  ),
};
