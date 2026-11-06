import type { Meta, StoryObj } from '@storybook/react-vite';
import { AlertBanner } from './index';

const meta = {
  title: 'Studio/AlertBanner',
  component: AlertBanner.Root,
  args: { className: 'w-[24rem]' },
  render: (args) => (
    <AlertBanner.Root {...args}>
      <AlertBanner.Title>New subscriber!</AlertBanner.Title>
      <AlertBanner.Detail>26 subscribers</AlertBanner.Detail>
    </AlertBanner.Root>
  ),
} satisfies Meta<typeof AlertBanner.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NewSubscriber: Story = {};

export const TitleOnly: Story = {
  render: (args) => (
    <AlertBanner.Root {...args}>
      <AlertBanner.Title>New subscriber!</AlertBanner.Title>
    </AlertBanner.Root>
  ),
};
