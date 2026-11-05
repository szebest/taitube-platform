import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../lib/variant-names';
import { ScrollArea } from './scroll-area';
import { scrollAreaStyles } from './scroll-area.variants';

const meta = {
  title: 'Primitives/ScrollArea',
  tags: ['text'],
  component: ScrollArea,
  args: { type: 'always', tabIndex: 0 },
} satisfies Meta<typeof ScrollArea>;

export default meta;

type Story = StoryObj<typeof meta>;

const TITLES = Array.from({ length: 16 }, (_, index) => `Episode ${index + 1}`);

export const VerticalSizes: Story = {
  render: (args) => (
    <div className="flex gap-stack">
      {variantNames(scrollAreaStyles.variants.size).map((size) => (
        <ScrollArea
          key={size}
          {...args}
          size={size}
          fade
          aria-label={`Queue, ${size} bar`}
          className="h-60 w-48 rounded-card bg-surface"
        >
          <ul className="m-0 flex list-none flex-col gap-inline p-inset-control text-body-sm text-fg">
            {TITLES.map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>
        </ScrollArea>
      ))}
    </div>
  ),
};

export const HorizontalShelf: Story = {
  render: (args) => (
    <ScrollArea {...args} fade aria-label="Shelf" className="w-[480px]">
      <div className="flex gap-shelf pb-3">
        {TITLES.map((title) => (
          <div
            key={title}
            className="flex aspect-video w-40 shrink-0 items-end rounded-thumb bg-tint-strong p-2 text-caption text-fg"
          >
            {title}
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
};
