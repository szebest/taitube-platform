import { axeViolations } from '@kit/web-testing/dom';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { AppProviders } from '#app/__tests__/providers';
import { AccessGate, type AccessGatePasswordFormProps } from '..';

function renderGate(form: Partial<AccessGatePasswordFormProps> = {}) {
  const onUnlock = vi.fn();
  render(
    <AccessGate.Root icon="lock">
      <AccessGate.Title>This video is protected</AccessGate.Title>
      <AccessGate.Description>Enter the password.</AccessGate.Description>
      <AccessGate.PasswordForm label="Password" submitLabel="Watch" onUnlock={onUnlock} {...form} />
    </AccessGate.Root>,
    { wrapper: AppProviders }
  );

  return { onUnlock, user: userEvent.setup() };
}

describe('apps/client/web: AccessGate', () => {
  it('names the gate as the page heading and hands over the password typed', async () => {
    const { onUnlock, user } = renderGate();

    expect(
      screen.getByRole('heading', { level: 1, name: 'This video is protected' })
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^Password/), 'hunter22{Enter}');

    expect(onUnlock).toHaveBeenCalledExactlyOnceWith('hunter22');
  });

  it('sends nothing for an empty field', async () => {
    const { onUnlock, user } = renderGate();

    await user.click(screen.getByRole('button', { name: 'Watch' }));

    expect(onUnlock).not.toHaveBeenCalled();
  });

  it('says why the last password was refused, on the field', () => {
    renderGate({ error: 'That password is not right.' });

    expect(screen.getByLabelText(/^Password/)).toHaveAccessibleDescription(
      'That password is not right.'
    );
  });

  it('holds the button while an attempt is on its way', () => {
    renderGate({ pending: true });

    expect(screen.getByRole('button', { name: 'Watch' })).toHaveAttribute('aria-busy', 'true');
  });

  it('has no accessibility violations', async () => {
    renderGate({ error: 'That password is not right.' });

    expect(await axeViolations()).toEqual([]);
  });
});
