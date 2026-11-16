import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../../lib/variant-names';
import { Kbd } from '../kbd';
import { kbdStyles } from '../kbd.variants';

const meta = {
  title: 'Primitives/Kbd',
  component: Kbd,
  args: { children: 'K' },
} satisfies Meta<typeof Kbd>;

export default meta;

type Story = StoryObj<typeof meta>;

export const KeysAndChords: Story = {
  render: (args) => (
    <div className="flex flex-col gap-stack text-body text-fg">
      {variantNames(kbdStyles.variants.variant).map((variant) => (
        <div key={variant} className="flex items-center gap-stack">
          {variantNames(kbdStyles.variants.size).map((size) => (
            <span key={size} className="flex items-center gap-inline">
              <Kbd {...args} variant={variant} size={size}>
                Ctrl
              </Kbd>
              <Kbd {...args} variant={variant} size={size} />
            </span>
          ))}
          <Kbd variant={variant}>Escape</Kbd>
        </div>
      ))}
      <p className="flex items-center gap-inline rounded-sm bg-fg p-2 text-bg w-fit">
        Search{' '}
        <Kbd variant="soft" size="sm">
          /
        </Kbd>
      </p>
    </div>
  ),
};
