import { ResponsiveModal } from '@kit/ui';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { AppProviders } from '#app/__tests__/providers';
import { SecretStep } from '../secret-step';

describe('apps/client/studio: SecretStep', () => {
  it('copies the secret under its label and describes the dialog with the warning', async () => {
    const user = userEvent.setup();
    render(
      <AppProviders>
        <ResponsiveModal.Root open>
          <ResponsiveModal.Content size="md">
            <SecretStep
              title="Copy your token"
              notice="Shown once."
              label="Token for CI"
              saved="I saved it"
              secret="tt_pat_1"
              onDone={vi.fn()}
            />
          </ResponsiveModal.Content>
        </ResponsiveModal.Root>
      </AppProviders>
    );

    expect(screen.getByRole('dialog', { name: 'Copy your token' })).toHaveAccessibleDescription(
      'Shown once.'
    );
    await user.click(screen.getByRole('button', { name: 'Copy' }));

    expect(await navigator.clipboard.readText()).toBe('tt_pat_1');
    expect(await screen.findByText('Copied: Token for CI')).toBeInTheDocument();
  });
});
