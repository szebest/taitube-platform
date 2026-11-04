import type { Meta, StoryObj } from '@storybook/react-vite';
import { variantNames } from '../../lib/variant-names';
import { Button } from '../button';
import { Callout } from '.';
import { CalloutRoot } from './callout';
import { calloutStyles } from './callout.variants';

const meta = {
  title: 'Primitives/Callout',
  component: CalloutRoot,
} satisfies Meta<typeof CalloutRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FillsAndTones: Story = {
  render: (args) => (
    <div className="grid grid-cols-2 gap-stack">
      {variantNames(calloutStyles.variants.variant).map((variant) => (
        <div key={variant} className="flex flex-col gap-inline">
          {variantNames(calloutStyles.variants.tone).map((tone) => (
            <Callout.Root key={tone} {...args} variant={variant} tone={tone}>
              <Callout.Icon />
              <Callout.Title>
                {variant} {tone}
              </Callout.Title>
              <Callout.Body>Your 4K upload may take a few minutes.</Callout.Body>
            </Callout.Root>
          ))}
        </div>
      ))}
    </div>
  ),
};

export const WithActionAndWithoutTitle: Story = {
  render: (args) => (
    <div className="flex max-w-[36rem] flex-col gap-stack">
      <Callout.Root {...args} tone="danger">
        <Callout.Icon />
        <Callout.Title>The upload failed</Callout.Title>
        <Callout.Body>
          The connection dropped at 62 percent. Your file is still on your device, so trying again
          starts from where it stopped rather than from the beginning.
        </Callout.Body>
        <Callout.Action>
          <Button size="sm" variant="solid" tone="accent">
            Try again
          </Button>
        </Callout.Action>
      </Callout.Root>
      <Callout.Root {...args} tone="neutral">
        <Callout.Body>Comments are off for this video.</Callout.Body>
      </Callout.Root>
    </div>
  ),
};
