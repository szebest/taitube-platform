import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, buttonVariants } from './button';
import { variantNames } from './variant-names';

const meta = {
  title: 'Primitives/Button',
  component: Button,
  args: { children: 'Upload' },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const EveryVariant: Story = {
  render: (args) => (
    <div className="tw:flex tw:flex-wrap tw:gap-3">
      {variantNames(buttonVariants.variants.variant).map((variant) => (
        <Button key={variant} {...args} variant={variant}>
          {variant}
        </Button>
      ))}
    </div>
  ),
};
