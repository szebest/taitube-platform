import { screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import { renderWithCopy } from '../../__tests__/render-with-copy';
import { SignedOutSection } from '..';

const renderSection = () =>
  renderWithCopy(
    <SignedOutSection.Root>
      <SignedOutSection.Line asChild>
        <h2>Your subscriptions live here</h2>
      </SignedOutSection.Line>
      <SignedOutSection.Action asChild>
        <a href="/login?redirect=%2F">Sign in</a>
      </SignedOutSection.Action>
    </SignedOutSection.Root>
  );

describe('@vp/components: SignedOutSection', () => {
  it('gives a guest one line and the link that signs in', () => {
    renderSection();

    expect(screen.getByRole('heading', { name: 'Your subscriptions live here' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login?redirect=%2F'
    );
  });

  it('passes axe', async () => {
    renderSection();

    expect(await axeViolations()).toEqual([]);
  });
});
