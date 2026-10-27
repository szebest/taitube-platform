import type { Meta, StoryObj } from '@storybook/react-vite';
import { ErrorState } from '.';
import { ErrorStateRoot } from './error-state';

const meta = {
  title: 'Components/ErrorState',
  component: ErrorStateRoot,
  args: { kind: 'server' },
} satisfies Meta<typeof ErrorStateRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithRetry: Story = {
  render: (args) => (
    <ErrorState.Root {...args} onRetry={() => undefined}>
      <ErrorState.Illustration />
      <ErrorState.Title asChild>
        <h1>We could not load this video</h1>
      </ErrorState.Title>
      <ErrorState.Description>
        The server took too long to answer. Your connection looks fine.
      </ErrorState.Description>
      <ErrorState.Retry />
      <ErrorState.Action asChild>
        <a href="/">Go to Home</a>
      </ErrorState.Action>
    </ErrorState.Root>
  ),
};

export const NotFound: Story = {
  args: { kind: 'not-found' },
  render: (args) => (
    <ErrorState.Root {...args}>
      <ErrorState.Illustration />
      <ErrorState.Title asChild>
        <h1>This page does not exist</h1>
      </ErrorState.Title>
      <ErrorState.Description>
        The link may be old, or the video was removed.
      </ErrorState.Description>
      <ErrorState.Action asChild>
        <a href="/">Go to Home</a>
      </ErrorState.Action>
    </ErrorState.Root>
  ),
};
