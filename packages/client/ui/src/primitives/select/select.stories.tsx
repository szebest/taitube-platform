import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../lib/variant-names';
import { Select } from '.';
import { selectStyles } from './select.variants';

const meta = {
  title: 'Primitives/Select',
  component: Select.Trigger,
} satisfies Meta<typeof Select.Trigger>;

export default meta;

type Story = StoryObj<typeof meta>;

const Options = () => (
  <Select.Content>
    <Select.Group>
      <Select.Label>Listed</Select.Label>
      <Select.Item value="public">Public</Select.Item>
    </Select.Group>
    <Select.Separator />
    <Select.Item value="unlisted">Unlisted</Select.Item>
    <Select.Item value="private" disabled>
      Private
    </Select.Item>
  </Select.Content>
);

export const FillsAndSizes: Story = {
  render: (args) => (
    <div className="tw:flex tw:max-w-xs tw:flex-col tw:gap-inline">
      {variantNames(selectStyles.variants.variant).flatMap((variant) =>
        variantNames(selectStyles.variants.size).map((size) => (
          <Select.Root key={`${variant}-${size}`} defaultValue="public">
            <Select.Trigger
              {...args}
              aria-label={`${variant} ${size}`}
              variant={variant}
              size={size}
            >
              <Select.Value />
            </Select.Trigger>
            <Options />
          </Select.Root>
        ))
      )}
      <Select.Root>
        <Select.Trigger {...args} aria-label="Placeholder" shape="pill">
          <Select.Value placeholder="Sort by" />
        </Select.Trigger>
        <Options />
      </Select.Root>
      <Select.Root disabled>
        <Select.Trigger {...args} aria-label="Disabled">
          <Select.Value placeholder="Disabled" />
        </Select.Trigger>
        <Options />
      </Select.Root>
    </div>
  ),
};
