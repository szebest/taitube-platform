import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../lib/variant-names';
import { ScrollArea } from './scroll-area';
import { scrollAreaStyles } from './scroll-area.variants';

const meta = {
  title: 'Primitives/ScrollArea',
  component: ScrollArea,
  args: { type: 'always', tabIndex: 0 },
} satisfies Meta<typeof ScrollArea>;

export default meta;

type Story = StoryObj<typeof meta>;

const TITLES = Array.from({ length: 16 }, (_, index) => `Episode ${index + 1}`);

export const VerticalSizes: Story = {
  render: (args) => (
    <div className="tw:flex tw:gap-stack">
      {variantNames(scrollAreaStyles.variants.size).map((size) => (
        <ScrollArea
          key={size}
          {...args}
          size={size}
          fade
          aria-label={`Queue, ${size} bar`}
          className="tw:h-60 tw:w-48 tw:rounded-card tw:bg-surface"
        >
          <ul className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-inline tw:p-inset-control tw:text-body-sm tw:text-fg">
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
    <ScrollArea {...args} fade aria-label="Shelf" className="tw:w-[480px]">
      <div className="tw:flex tw:gap-shelf tw:pb-3">
        {TITLES.map((title) => (
          <div
            key={title}
            className="tw:flex tw:aspect-video tw:w-40 tw:shrink-0 tw:items-end tw:rounded-thumb tw:bg-tint-strong tw:p-2 tw:text-caption tw:text-fg"
          >
            {title}
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
};
