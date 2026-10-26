import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../lib/variant-names';
import { Icon } from '../icon';
import { ToggleGroup } from '.';
import { ToggleGroupRoot } from './toggle-group';
import { toggleGroupStyles } from './toggle-group.variants';

const meta = {
  title: 'Primitives/ToggleGroup',
  component: ToggleGroupRoot,
  args: { type: 'multiple' },
} satisfies Meta<typeof ToggleGroupRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FillsAndSizes: Story = {
  render: () => (
    <div className="tw:flex tw:flex-col tw:gap-stack">
      {variantNames(toggleGroupStyles.variants.variant).flatMap((variant) =>
        variantNames(toggleGroupStyles.variants.size).map((size) => (
          <ToggleGroup.Root
            key={`${variant}-${size}`}
            type="multiple"
            aria-label={`${variant} ${size}`}
            variant={variant}
            size={size}
            defaultValue={['grid']}
          >
            <ToggleGroup.Item value="grid">
              <Icon name="layout" />
              Grid
            </ToggleGroup.Item>
            <ToggleGroup.Item value="list">
              <Icon name="playlist" />
              List
            </ToggleGroup.Item>
            <ToggleGroup.Item value="more" disabled>
              More
            </ToggleGroup.Item>
          </ToggleGroup.Root>
        ))
      )}
    </div>
  ),
};

export const IconOnlyPillAndVertical: Story = {
  render: () => (
    <div className="tw:flex tw:items-start tw:gap-stack">
      <ToggleGroup.Root type="single" aria-label="View" variant="outline" shape="pill">
        <ToggleGroup.Item value="grid" aria-label="Grid">
          <Icon name="layout" />
        </ToggleGroup.Item>
        <ToggleGroup.Item value="list" aria-label="List">
          <Icon name="playlist" />
        </ToggleGroup.Item>
      </ToggleGroup.Root>
      <ToggleGroup.Root
        type="single"
        aria-label="Sort"
        variant="soft"
        orientation="vertical"
        defaultValue="new"
      >
        <ToggleGroup.Item value="new">Newest</ToggleGroup.Item>
        <ToggleGroup.Item value="top">Top</ToggleGroup.Item>
      </ToggleGroup.Root>
    </div>
  ),
};
