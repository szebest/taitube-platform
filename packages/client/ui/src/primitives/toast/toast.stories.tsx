import type { Meta, StoryObj } from '@storybook/react-vite';
import { Toast as ToastPrimitive } from 'radix-ui';
import { Button } from '../button';
import { variantNames } from '../../lib/variant-names';
import { Toast } from '.';
import { ToastRoot } from './toast';
import { toastStyles } from './toast.variants';

const meta = {
  title: 'Primitives/Toast',
  component: ToastRoot,
} satisfies Meta<typeof ToastRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Tones: Story = {
  render: () => (
    <ToastPrimitive.Provider duration={Number.POSITIVE_INFINITY}>
      {variantNames(toastStyles.variants.tone).map((tone) => (
        <Toast.Root key={tone} tone={tone} defaultOpen className="tw:mb-stack tw:max-w-sm">
          <Toast.Icon />
          <Toast.Title>Could not save</Toast.Title>
          <Toast.Description>Check your connection.</Toast.Description>
          {tone === 'danger' && (
            <Toast.Action altText="Retry saving" asChild>
              <Button size="sm">Retry</Button>
            </Toast.Action>
          )}
          <Toast.Close />
        </Toast.Root>
      ))}
      <ToastPrimitive.Viewport />
    </ToastPrimitive.Provider>
  ),
};
