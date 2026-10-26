import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../lib/variant-names';
import { buttonStyles } from '../button';
import { Icon } from '../icon';
import { IconButton } from './icon-button';

const meta = {
  title: 'Primitives/IconButton',
  component: IconButton,
  args: { 'aria-label': 'Save to Watch later', children: <Icon name="save" /> },
} satisfies Meta<typeof IconButton>;

export default meta;

type Story = StoryObj<typeof meta>;

const PAIRS = [
  { variant: 'ghost', tone: 'neutral' },
  { variant: 'soft', tone: 'neutral' },
  { variant: 'outline', tone: 'neutral' },
  { variant: 'solid', tone: 'accent' },
  { variant: 'solid', tone: 'neutral' },
  { variant: 'ghost', tone: 'danger' },
] as const;

export const FillsSizesAndStates: Story = {
  render: (args) => (
    <div className="tw:flex tw:flex-col tw:gap-stack tw:text-caption tw:text-fg-muted">
      {variantNames(buttonStyles.variants.size).map((size) => (
        <div key={size} className="tw:flex tw:items-center tw:gap-inline">
          <span className="tw:w-8">{size}</span>
          {PAIRS.map(({ variant, tone }) => (
            <IconButton
              key={`${variant}-${tone}`}
              {...args}
              size={size}
              variant={variant}
              tone={tone}
            />
          ))}
        </div>
      ))}
      <div className="tw:flex tw:items-center tw:gap-inline">
        <span className="tw:w-8">states</span>
        <IconButton {...args} aria-pressed />
        <IconButton {...args} disabled />
        <IconButton {...args} asChild={false} loading />
      </div>
    </div>
  ),
};
