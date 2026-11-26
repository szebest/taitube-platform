import { Avatar } from '@kit/ui';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AccentRing } from '..';

const meta = {
  title: 'Components/AccentRing',
  component: AccentRing,
  args: { accent: 1 },
} satisfies Meta<typeof AccentRing>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EveryAccent: Story = {
  render: () => (
    <div className="flex gap-section p-stack">
      {([1, 2, 3, 4, 5, 6] as const).map((accent) => (
        <AccentRing key={accent} accent={accent}>
          <Avatar.Root size="md">
            <Avatar.Fallback aria-hidden="true">{String(accent)}</Avatar.Fallback>
          </Avatar.Root>
        </AccentRing>
      ))}
    </div>
  ),
};
