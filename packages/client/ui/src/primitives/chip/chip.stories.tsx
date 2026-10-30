import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../lib/variant-names';
import { Icon } from '../icon';
import { Chip, ChipGroup } from '.';
import { chipStyles } from './chip.variants';

const meta = {
  title: 'Primitives/Chip',
  component: Chip,
  args: { children: 'Music' },
  tags: ['motion'],
} satisfies Meta<typeof Chip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FillsAndSizes: Story = {
  render: (args) => (
    <div className="tw:flex tw:flex-col tw:gap-inline">
      {variantNames(chipStyles.variants.variant).map((variant) => (
        <div key={variant} className="tw:flex tw:items-center tw:gap-inline">
          {variantNames(chipStyles.variants.size).map((size) => (
            <div key={size} className="tw:flex tw:items-center tw:gap-inline">
              <Chip {...args} variant={variant} size={size} aria-pressed="false" />
              <Chip {...args} variant={variant} size={size} aria-pressed="true">
                <Icon name="check" />
                Selected
              </Chip>
              <Chip {...args} variant={variant} size={size} disabled>
                Disabled
              </Chip>
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
};

export const Group: Story = {
  render: () => (
    <ChipGroup.Root
      type="single"
      aria-label="Category"
      defaultValue="all"
      className="tw:max-w-[24rem]"
    >
      {['All', 'Music', 'Gaming', 'News', 'Live', 'Cooking', 'Podcasts'].map((name) => (
        <ChipGroup.Item key={name} value={name.toLowerCase()}>
          {name}
        </ChipGroup.Item>
      ))}
    </ChipGroup.Root>
  ),
};

export const GroupSlides: Story = {
  ...Group,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const indicator = canvasElement.querySelector('[data-slot="chip-group-indicator"]');
    await userEvent.click(canvas.getByRole('radio', { name: 'Gaming' }));

    const slid = (indicator?.getAnimations().length ?? 0) > 0;
    const reduced = document.documentElement.dataset.motion === 'reduced';
    if (slid === reduced) {
      throw new Error(reduced ? 'the pill moved under reduced motion' : 'the pill did not slide');
    }
  },
};

export const GroupSlidesReduced: Story = { ...GroupSlides, globals: { motion: 'reduced' } };
