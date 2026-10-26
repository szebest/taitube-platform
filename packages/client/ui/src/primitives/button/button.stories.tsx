import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../lib/variant-names';
import { Icon } from '../icon';
import { Button } from './button';
import { buttonStyles } from './button.variants';

const meta = {
  title: 'Primitives/Button',
  component: Button,
  args: { children: 'Upload' },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FillsAndTones: Story = {
  render: (args) => (
    <div className="tw:grid tw:w-fit tw:grid-cols-3 tw:gap-inline">
      {variantNames(buttonStyles.variants.variant).flatMap((variant) =>
        variantNames(buttonStyles.variants.tone).map((tone) => (
          <Button key={`${variant}-${tone}`} {...args} variant={variant} tone={tone}>
            {variant} {tone}
          </Button>
        ))
      )}
    </div>
  ),
};

export const SizesShapesAndStates: Story = {
  render: (args) => (
    <div className="tw:flex tw:flex-col tw:gap-stack">
      {variantNames(buttonStyles.variants.size).map((size) => (
        <div key={size} className="tw:flex tw:items-center tw:gap-inline">
          <Button {...args} size={size}>
            <Icon name="upload" />
            Upload {size}
          </Button>
          <Button {...args} size={size} shape="pill" variant="solid" tone="accent">
            Subscribe
            <Icon name="chevron-right" />
          </Button>
          <Button {...args} size={size} shape="icon" variant="ghost" aria-label="More">
            <Icon name="more" />
          </Button>
        </div>
      ))}
      <div className="tw:flex tw:items-center tw:gap-inline">
        <Button {...args} disabled>
          Disabled
        </Button>
        <Button {...args} asChild={false} variant="solid" tone="accent" loading>
          Publishing
        </Button>
        <Button asChild variant="outline">
          <a href="#studio">Open the studio</a>
        </Button>
      </div>
    </div>
  ),
};
