import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../lib/variant-names';
import { SegmentedControl } from '.';
import { SegmentedControlRoot } from './segmented-control';
import { segmentedControlStyles } from './segmented-control.variants';

const meta = {
  title: 'Primitives/SegmentedControl',
  component: SegmentedControlRoot,
  tags: ['motion'],
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

export const Slides: Story = {
  render: () => (
    <SegmentedControl.Root aria-label="Comment order" defaultValue="newest">
      <SegmentedControl.Item value="top">Top</SegmentedControl.Item>
      <SegmentedControl.Item value="newest">Newest</SegmentedControl.Item>
      <SegmentedControl.Item value="oldest">Oldest</SegmentedControl.Item>
    </SegmentedControl.Root>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const indicator = canvasElement.querySelector('[data-slot="segmented-control-indicator"]');
    await userEvent.click(canvas.getByRole('radio', { name: 'Oldest' }));

    const slid = (indicator?.getAnimations().length ?? 0) > 0;
    const reduced = document.documentElement.dataset.motion === 'reduced';
    if (slid === reduced) {
      throw new Error(reduced ? 'the thumb moved under reduced motion' : 'the thumb did not slide');
    }
  },
};

export const SlidesReduced: Story = { ...Slides, globals: { motion: 'reduced' } };
