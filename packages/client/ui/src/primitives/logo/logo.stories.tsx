import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../lib/variant-names';
import { Logo } from './logo';
import { logoStyles } from './logo.variants';

const meta = {
  title: 'Primitives/Logo',
  component: Logo,
} satisfies Meta<typeof Logo>;

export default meta;

type Story = StoryObj<typeof meta>;

const GROUNDS = [
  { ground: 'bg-bg', ink: undefined },
  { ground: 'bg-surface', ink: undefined },
  { ground: 'bg-media', ink: 'text-on-live' },
];

export const VariantsSizesAndTones: Story = {
  render: (args) => (
    <div className="flex flex-col gap-stack">
      {variantNames(logoStyles.variants.size).map((size) => (
        <div key={size} className="flex items-center gap-section">
          {variantNames(logoStyles.variants.variant).map((variant) => (
            <Logo key={variant} {...args} size={size} variant={variant} />
          ))}
        </div>
      ))}
      {GROUNDS.map(({ ground, ink }) => (
        <div
          key={ground}
          className={`flex gap-section rounded-card p-inset-card ${ground}`}
        >
          <Logo {...args} tone="accent" />
          <Logo {...args} className={ink} />
        </div>
      ))}
    </div>
  ),
};
