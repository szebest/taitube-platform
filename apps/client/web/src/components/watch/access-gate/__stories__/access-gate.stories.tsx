import type { Meta, StoryObj } from '@storybook/react-vite';
import { AccessGate } from '..';

const meta = {
  title: 'Web/AccessGate',
  tags: ['text', 'translated'],
  component: AccessGate.Root,
  args: { icon: 'lock' },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AccessGate.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

type LockedForm = Omit<Parameters<typeof AccessGate.PasswordForm>[0], 'label' | 'submitLabel'>;

const locked = (form: LockedForm) => (
  <>
    <AccessGate.Title>This video is protected</AccessGate.Title>
    <AccessGate.Description>
      Enter the password its creator gave you to watch it.
    </AccessGate.Description>
    <AccessGate.PasswordForm label="Password" submitLabel="Watch" {...form} />
  </>
);

export const Locked: Story = {
  args: { children: locked({ onUnlock: () => undefined }) },
};

export const WrongPassword: Story = {
  args: {
    children: locked({ onUnlock: () => undefined, error: 'That password is not right.' }),
  },
};

export const RateLimited: Story = {
  args: {
    children: locked({
      onUnlock: () => undefined,
      error: 'Too many requests. Wait a moment and try again.',
    }),
  },
};

export const Unlocking: Story = {
  args: { children: locked({ onUnlock: () => undefined, pending: true }) },
};

export const LinkExpired: Story = {
  args: {
    icon: 'clock',
    children: (
      <>
        <AccessGate.Title>This link no longer works</AccessGate.Title>
        <AccessGate.Description>
          It expired or its creator turned it off. Ask them for a new link.
        </AccessGate.Description>
        <AccessGate.Action asChild variant="solid" tone="accent">
          <a href="/">Go to the home page</a>
        </AccessGate.Action>
      </>
    ),
  },
};

export const InAnEmbed: Story = {
  args: {
    size: 'section',
    children: (
      <>
        <AccessGate.Title>This video is protected</AccessGate.Title>
        <AccessGate.Action asChild variant="solid" tone="accent">
          <a href="/watch/launch-day" target="_blank" rel="noopener">
            Open on Taitube to enter the password
          </a>
        </AccessGate.Action>
      </>
    ),
  },
};
