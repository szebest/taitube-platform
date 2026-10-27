import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../lib/variant-names';
import { Icon } from '../icon';
import { IconButton } from '../icon-button';
import { Input, InputGroup } from '.';
import { inputStyles } from './input.variants';

const meta = {
  title: 'Primitives/Input',
  component: Input,
  args: { placeholder: 'Add a title' },
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FillsSizesAndShapes: Story = {
  render: (args) => (
    <div className="tw:flex tw:max-w-[28rem] tw:flex-col tw:gap-inline">
      {variantNames(inputStyles.variants.variant).flatMap((variant) =>
        variantNames(inputStyles.variants.size).map((size) => (
          <Input
            key={`${variant}-${size}`}
            {...args}
            aria-label={`${variant} ${size}`}
            variant={variant}
            size={size}
          />
        ))
      )}
      <Input {...args} aria-label="pill" shape="pill" />
    </div>
  ),
};

export const States: Story = {
  render: (args) => (
    <div className="tw:flex tw:max-w-[28rem] tw:flex-col tw:gap-inline">
      <Input {...args} aria-label="disabled" disabled />
      <Input {...args} aria-label="read only" readOnly defaultValue="Read only" />
      <Input {...args} aria-label="invalid" aria-invalid defaultValue="Too short" />
    </div>
  ),
};

export const Adornments: Story = {
  render: () => (
    <div className="tw:flex tw:max-w-[28rem] tw:flex-col tw:gap-inline">
      <InputGroup.Root variant="soft" shape="pill">
        <InputGroup.Start>
          <Icon name="search" />
        </InputGroup.Start>
        <Input type="search" aria-label="Search" defaultValue="lofi" />
        <InputGroup.End>
          <IconButton aria-label="Clear" size="sm">
            <Icon name="close" />
          </IconButton>
        </InputGroup.End>
      </InputGroup.Root>
      <InputGroup.Root>
        <InputGroup.Start>https://</InputGroup.Start>
        <Input aria-label="Address" defaultValue="taitube.example" />
        <InputGroup.End>.com</InputGroup.End>
      </InputGroup.Root>
    </div>
  ),
};
