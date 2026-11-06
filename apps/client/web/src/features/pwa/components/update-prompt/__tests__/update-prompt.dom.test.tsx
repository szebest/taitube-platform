import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createToaster, ToastProvider } from '@vp/ui';
import { AppProviders } from '#app/__tests__/providers';
import * as registration from '../register-service-worker';
import { UpdatePrompt } from '../update-prompt';

function renderPrompt() {
  const stop = vi.fn();
  const register = vi.spyOn(registration, 'registerServiceWorker').mockReturnValue(stop);
  const view = render(
    <AppProviders>
      <ToastProvider toaster={createToaster()}>
        <UpdatePrompt />
      </ToastProvider>
    </AppProviders>
  );
  return { register, stop, ...view };
}

describe('apps/client/web: UpdatePrompt', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('registers nothing on the dev server', () => {
    const { register } = renderPrompt();

    expect(register).not.toHaveBeenCalled();
  });

  it('registers nothing in a browser without service workers', () => {
    vi.stubEnv('DEV', false);

    const { register } = renderPrompt();

    expect(register).not.toHaveBeenCalled();
  });

  it('offers a reload when a new version waits, and activates it on request', async () => {
    vi.stubEnv('DEV', false);
    Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true });
    const { register } = renderPrompt();
    const activate = vi.fn();

    act(() => register.mock.calls[0]?.[0].onWaiting(activate));

    expect(await screen.findByText('A new version of Taitube is ready')).toBeInTheDocument();
    expect(activate).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Reload to update' }));
    expect(activate).toHaveBeenCalledOnce();
  });

  it('stops listening when it unmounts', () => {
    vi.stubEnv('DEV', false);
    Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true });
    const { stop, unmount } = renderPrompt();

    unmount();

    expect(stop).toHaveBeenCalledOnce();
  });
});
