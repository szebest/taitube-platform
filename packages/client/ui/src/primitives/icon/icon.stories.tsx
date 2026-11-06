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
    <div className="flex flex-col gap-stack">
      {variantNames(iconStyles.variants.tone).map((tone) => (
        <div
          key={tone}
          className="flex items-center gap-inline text-caption text-fg-muted"
        >
          <span className="w-16">{tone}</span>
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
    <ul className="m-0 grid list-none grid-cols-8 gap-stack p-0">
      {variantNames(ICONS).map((name) => (
        <li
          key={name}
          className="flex flex-col items-center gap-inline text-caption text-fg-muted"
        >
          <Icon name={name} />
          {name}
        </li>
      ))}
    </ul>
  ),
};
