import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProviders } from '#app/__tests__/providers';
import { SubscribeButton } from '../subscribe-button';

function renderButton({ subscribed = false, pending = false } = {}) {
  const onToggle = vi.fn();
  render(
    <AppProviders>
      <SubscribeButton subscribed={subscribed} pending={pending} onToggle={onToggle}>
        {subscribed ? 'Subscribed' : 'Subscribe'}
      </SubscribeButton>
    </AppProviders>
  );
  return { onToggle };
}

describe('apps/client/web: SubscribeButton', () => {
  it.each([
    { subscribed: false, label: 'Subscribe', pressed: 'false' },
    { subscribed: true, label: 'Subscribed', pressed: 'true' },
  ])('is a toggle named $label, pressed $pressed', ({ subscribed, label, pressed }) => {
    renderButton({ subscribed });

    expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', pressed);
  });

  it('holds the result with aria-busy while pending', () => {
    renderButton({ pending: true });

    expect(screen.getByRole('button', { name: 'Subscribe' })).toHaveAttribute('aria-busy', 'true');
  });

  it('toggles when pressed', async () => {
    const { onToggle } = renderButton();

    await userEvent.click(screen.getByRole('button', { name: 'Subscribe' }));

    expect(onToggle).toHaveBeenCalledOnce();
  });
});
