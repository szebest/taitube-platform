import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../lib/variant-names';
import { Icon } from '../icon';
import { Chip, ChipGroup } from '.';
import { chipStyles } from './chip.variants';

const meta = {
  title: 'Primitives/Chip',
  component: Chip,
  args: { children: 'Music' },
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
    <ChipGroup.Root type="single" aria-label="Category" defaultValue="all" className="tw:max-w-sm">
      {['All', 'Music', 'Gaming', 'News', 'Live', 'Cooking', 'Podcasts'].map((name) => (
        <ChipGroup.Item key={name} value={name.toLowerCase()}>
          {name}
        </ChipGroup.Item>
      ))}
    </ChipGroup.Root>
  ),
};
