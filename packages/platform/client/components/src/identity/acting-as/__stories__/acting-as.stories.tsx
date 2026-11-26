import type { Meta, StoryObj } from '@storybook/react-vite';
import { ActingAs } from '..';

const meta = {
  title: 'Components/ActingAs',
  component: ActingAs.Root,
} satisfies Meta<typeof ActingAs.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Composer: Story = {
  render: () => (
    <div className="w-96 p-stack">
      <ActingAs.Root>
        <ActingAs.Avatar name="Analytical Engines" accent={3} />
        <ActingAs.Label>Commenting as Analytical Engines</ActingAs.Label>
        <ActingAs.Switch>Switch</ActingAs.Switch>
      </ActingAs.Root>
    </div>
  ),
};
