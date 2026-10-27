import { screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
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

  it('passes axe with both lines shown', async () => {
    renderLogin({ expired: true, error: 'That did not work.' });

    expect(await axeViolations()).toEqual([]);
  });
});
