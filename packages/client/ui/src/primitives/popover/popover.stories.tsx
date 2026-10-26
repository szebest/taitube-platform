import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../button';
import { Field } from '../field';
import { Input } from '../input';
import { variantNames } from '../../lib/variant-names';
import { Popover } from '.';
import { PopoverContent } from './popover';
import { popoverStyles } from './popover.variants';

const meta = {
  title: 'Primitives/Popover',
  component: PopoverContent,
} satisfies Meta<typeof PopoverContent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Sizes: Story = {
  render: (args) => (
    <div className="tw:flex tw:flex-col tw:gap-section tw:p-section">
      {variantNames(popoverStyles.variants.size).map((size) => (
        <Popover.Root key={size} open>
          <Popover.Trigger asChild>
            <Button variant="outline">Share ({size})</Button>
          </Popover.Trigger>
          <Popover.Content {...args} size={size} side="inline-end" aria-label={`Share ${size}`}>
            <Popover.Arrow />
            <Field.Root>
              <Field.Label>Link</Field.Label>
              <Input readOnly value="https://taitube.local/watch/lisbon" />
            </Field.Root>
          </Popover.Content>
        </Popover.Root>
      ))}
    </div>
  ),
};
