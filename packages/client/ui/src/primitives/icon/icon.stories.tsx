import type { Meta, StoryObj } from '@storybook/react-vite';
import { ICONS } from '../../icons/inventory';
import { variantNames } from '../../lib/variant-names';
import { Icon } from './icon';
import { iconStyles } from './icon.variants';

const meta = {
  title: 'Primitives/Icon',
  component: Icon,
  args: { name: 'search' },
} satisfies Meta<typeof Icon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SizesAndTones: Story = {
  render: (args) => (
    <div className="tw:flex tw:flex-col tw:gap-stack">
      {variantNames(iconStyles.variants.tone).map((tone) => (
        <div key={tone} className="tw:flex tw:items-center tw:gap-inline">
          {variantNames(iconStyles.variants.size).map((size) => (
            <Icon key={size} {...args} size={size} tone={tone} />
          ))}
          <Icon name="chevron-right" tone={tone} />
          <Icon name="verified" tone={tone} aria-label="Verified channel" />
        </div>
      ))}
    </div>
  ),
};

export const Inventory: Story = {
  render: () => (
    <ul className="tw:m-0 tw:grid tw:list-none tw:grid-cols-8 tw:gap-stack tw:p-0">
      {variantNames(ICONS).map((name) => (
        <li key={name} className="tw:flex tw:flex-col tw:items-center tw:gap-inline tw:text-caption tw:text-fg-muted">
          <Icon name={name} />
          {name}
        </li>
      ))}
    </ul>
  ),
};
