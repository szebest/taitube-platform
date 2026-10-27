import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import type { ComponentPropsWithRef } from 'react';

import { AppProviders } from '#app/__tests__/providers';
import { OfflineState } from '..';
import type { OfflineStateRootProps } from '../offline-state';

const RouterLink = (props: ComponentPropsWithRef<'a'>) => <a {...props} />;

function renderOffline(props: Partial<OfflineStateRootProps> = {}) {
  const onRetry = vi.fn<() => void | Promise<void>>();
  const rendered = render(
    <AppProviders>
      <OfflineState.Root onRetry={onRetry} {...props}>
        <OfflineState.Title asChild>
          <h2>You are offline</h2>
        </OfflineState.Title>
        <OfflineState.Description>Saved videos and your queue still work.</OfflineState.Description>
        <OfflineState.Available>
          <OfflineState.Link count="6 videos" asChild>
            <RouterLink href="/feed/watch-later">Watch later</RouterLink>
          </OfflineState.Link>
        </OfflineState.Available>
        <OfflineState.Action asChild>
          <a href="/you/downloads">Open Downloads</a>
        </OfflineState.Action>
      </OfflineState.Root>
    </AppProviders>
  );

  return { ...rendered, onRetry, user: userEvent.setup() };
}

describe('apps/client/web: OfflineState', () => {
  it('lists what still works as links with their counts, under a heading', () => {
    renderOffline();

    expect(screen.getByRole('heading', { name: 'You are offline' })).toBeInTheDocument();
    expect(screen.getByText('Available offline')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Watch later 6 videos' })).toHaveAttribute(
      'href',
      '/feed/watch-later'
    );
  });

  it.each([
    { size: 'banner', role: 'status' },
    { size: 'page', role: null },
    { size: 'section', role: null },
  ] as const)('is a polite status only as the $size it is', ({ size, role }) => {
    renderOffline({ size });

    expect(document.querySelector('[data-slot="offline-state"]')?.getAttribute('role')).toBe(role);
  });

  it('shows a spinner on the retry while it checks, then says it is still offline', async () => {
    let finishCheck: () => void = () => undefined;
    const { user, onRetry } = renderOffline();
    onRetry.mockReturnValue(
      new Promise<void>((resolve) => {
        finishCheck = resolve;
      })
    );
    const retry = screen.getByRole('button', { name: 'Try again' });

    await user.click(retry);

    expect(retry).toHaveAttribute('aria-busy', 'true');

    await act(async () => finishCheck());

    expect(retry).not.toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Still offline');
  });

  it('confirms the reconnection with no retry, and dismisses itself after four seconds', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <AppProviders>
        <OfflineState.Root tone="success" onRetry={vi.fn()}>
          <OfflineState.Reconnected onDismiss={onDismiss} />
        </OfflineState.Root>
      </AppProviders>
    );

    expect(screen.getByRole('status')).toHaveTextContent('Back online');
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(4000));

    expect(onDismiss).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('names a part used outside its root', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() =>
      render(
        <AppProviders>
          <OfflineState.Description>Offline</OfflineState.Description>
        </AppProviders>
      )
    ).toThrow('OfflineState.Description must be inside OfflineState.Root');
  });

  it.each(['page', 'banner', 'section'] as const)('passes axe as a %s', async (size) => {
    renderOffline({ size });

    expect(await axeViolations()).toEqual([]);
  });
});
