import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../lib/variant-names';
import { Kbd } from './kbd';
import { kbdStyles } from './kbd.variants';

const meta = {
  title: 'Primitives/Kbd',
  component: Kbd,
  args: { children: 'K' },
} satisfies Meta<typeof Kbd>;

export default meta;

type Story = StoryObj<typeof meta>;

export const KeysAndChords: Story = {
  render: (args) => (
    <div className="tw:flex tw:flex-col tw:gap-stack tw:text-body tw:text-fg">
      {variantNames(kbdStyles.variants.variant).map((variant) => (
        <div key={variant} className="tw:flex tw:items-center tw:gap-stack">
          {variantNames(kbdStyles.variants.size).map((size) => (
            <span key={size} className="tw:flex tw:items-center tw:gap-inline">
              <Kbd {...args} variant={variant} size={size}>
                Ctrl
              </Kbd>
              <Kbd {...args} variant={variant} size={size} />
            </span>
          ))}
          <Kbd variant={variant}>Escape</Kbd>
        </div>
      ))}
      <p className="tw:flex tw:items-center tw:gap-inline tw:rounded-sm tw:bg-fg tw:p-2 tw:text-bg tw:w-fit">
        Search{' '}
        <Kbd variant="soft" size="sm">
          /
        </Kbd>
      </p>
    </div>
  ),
};
