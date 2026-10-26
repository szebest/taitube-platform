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
  { ground: 'tw:bg-bg', ink: undefined },
  { ground: 'tw:bg-surface', ink: undefined },
  { ground: 'tw:bg-media', ink: 'tw:text-on-live' },
];

export const VariantsSizesAndTones: Story = {
  render: (args) => (
    <div className="tw:flex tw:flex-col tw:gap-stack">
      {variantNames(logoStyles.variants.size).map((size) => (
        <div key={size} className="tw:flex tw:items-center tw:gap-section">
          {variantNames(logoStyles.variants.variant).map((variant) => (
            <Logo key={variant} {...args} size={size} variant={variant} />
          ))}
        </div>
      ))}
      {GROUNDS.map(({ ground, ink }) => (
        <div
          key={ground}
          className={`tw:flex tw:gap-section tw:rounded-card tw:p-inset-card ${ground}`}
        >
          <Logo {...args} tone="accent" />
          <Logo {...args} className={ink} />
        </div>
      ))}
    </div>
  ),
};
