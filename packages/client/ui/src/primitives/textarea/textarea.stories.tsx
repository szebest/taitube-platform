import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../lib/variant-names';
import { Textarea } from '.';
import { textareaStyles } from './textarea.variants';

const meta = {
  title: 'Primitives/Textarea',
  component: Textarea,
  args: { placeholder: 'Add a comment' },
} satisfies Meta<typeof Textarea>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FillsAndSizes: Story = {
  render: (args) => (
    <div className="tw:flex tw:max-w-[28rem] tw:flex-col tw:gap-inline">
      {variantNames(textareaStyles.variants.variant).flatMap((variant) =>
        variantNames(textareaStyles.variants.size).map((size) => (
          <Textarea
            key={`${variant}-${size}`}
            {...args}
            aria-label={`${variant} ${size}`}
            variant={variant}
            size={size}
          />
        ))
      )}
    </div>
  ),
};

export const AutoGrowAndStates: Story = {
  render: (args) => (
    <div className="tw:flex tw:max-w-[28rem] tw:flex-col tw:gap-inline">
      <Textarea
        {...args}
        aria-label="auto grow"
        autoGrow
        defaultValue={'One line\nTwo lines\nThree lines\nFour lines'}
      />
      <Textarea {...args} aria-label="disabled" disabled />
      <Textarea {...args} aria-label="invalid" aria-invalid defaultValue="Too long" />
    </div>
  ),
};
