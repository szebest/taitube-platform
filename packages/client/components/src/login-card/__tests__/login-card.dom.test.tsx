import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { useState } from 'react';
import { renderWithCopy } from '../../__tests__/render-with-copy';
import { LoginCard } from '..';

const renderLogin = (extras: { expired?: boolean; error?: string } = {}) =>
  renderWithCopy(
    <LoginCard.Root>
      <LoginCard.Title>Sign in</LoginCard.Title>
      {extras.expired && <LoginCard.Expired>Your session ended.</LoginCard.Expired>}
      {extras.error && <LoginCard.Error>{extras.error}</LoginCard.Error>}
      <LoginCard.Body>
        <button type="button">Creator</button>
      </LoginCard.Body>
    </LoginCard.Root>
  );

function FailingForm() {
  const [failed, setFailed] = useState(false);

  return (
    <LoginCard.Root>
      <LoginCard.Title>Sign in</LoginCard.Title>
      {failed && <LoginCard.Error>That did not work.</LoginCard.Error>}
      <LoginCard.Body>
        <input aria-label="Email" />
        <button type="button" onClick={() => setFailed(true)}>
          Sign in
        </button>
      </LoginCard.Body>
    </LoginCard.Root>
  );
}

describe('@vp/components: LoginCard', () => {
  it('is the region its title names, with the ways to sign in inside', () => {
    renderLogin();

    expect(screen.getByRole('region', { name: 'Sign in' })).toContainElement(
      screen.getByRole('button', { name: 'Creator' })
    );
  });

  it('says once that the session ended, and shows a failed sign-in as an alert', () => {
    renderLogin({ expired: true, error: 'That did not work.' });

    expect(screen.getByRole('status')).toHaveTextContent('Your session ended.');
    expect(screen.getByRole('alert')).toHaveTextContent('That did not work.');
  });

  it('moves focus to a failed sign-in as it appears and keeps what was typed', async () => {
    renderWithCopy(<FailingForm />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Email' }), 'ada@example.com');

    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByRole('alert')).toHaveFocus();
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('ada@example.com');
  });

  it('passes axe with both lines shown', async () => {
    renderLogin({ expired: true, error: 'That did not work.' });

    expect(await axeViolations()).toEqual([]);
  });
});
