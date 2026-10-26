import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../lib/variant-names';
import { SegmentedControl } from '.';
import { SegmentedControlRoot } from './segmented-control';
import { segmentedControlStyles } from './segmented-control.variants';

const meta = {
  title: 'Primitives/SegmentedControl',
  component: SegmentedControlRoot,
} satisfies Meta<typeof SegmentedControlRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TonesAndSizes: Story = {
  render: () => (
    <div className="tw:flex tw:flex-col tw:items-start tw:gap-stack">
      {variantNames(segmentedControlStyles.variants.tone).flatMap((tone) =>
        variantNames(segmentedControlStyles.variants.size).map((size) => (
          <SegmentedControl.Root
            key={`${tone}-${size}`}
            aria-label={`${tone} ${size}`}
            tone={tone}
            size={size}
            defaultValue="newest"
          >
            <SegmentedControl.Item value="top">Top</SegmentedControl.Item>
            <SegmentedControl.Item value="newest">Newest</SegmentedControl.Item>
            <SegmentedControl.Item value="oldest" disabled>
              Oldest
            </SegmentedControl.Item>
          </SegmentedControl.Root>
        ))
      )}
    </div>
  ),
};
