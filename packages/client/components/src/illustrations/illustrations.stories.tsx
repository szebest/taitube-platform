import type { Meta, StoryObj } from '@storybook/react-vite';
import * as illustrations from '.';

const meta = {
  title: 'Components/Illustrations',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const All: Story = {
  render: () => (
    <div className="tw:grid tw:grid-cols-4 tw:gap-stack tw:text-accent">
      {Object.entries(illustrations).map(([name, Drawing]) => (
        <figure key={name} className="tw:m-0 tw:flex tw:flex-col tw:items-center tw:gap-inline">
          <Drawing className="tw:w-40" />
          <figcaption className="tw:text-caption tw:text-fg-muted">{name}</figcaption>
        </figure>
      ))}
    </div>
  ),
};
