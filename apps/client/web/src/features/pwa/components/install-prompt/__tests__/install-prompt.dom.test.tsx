import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProviders } from '#app/__tests__/providers';
import { InstallPrompt } from '../install-prompt';

function renderPrompt() {
  const prompt = vi.fn().mockResolvedValue(undefined);
  render(
    <AppProviders>
      <InstallPrompt />
    </AppProviders>
  );
  act(() => {
    window.dispatchEvent(
      Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt })
    );
  });
  return { prompt };
}

describe('apps/client/web: InstallPrompt', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('renders nothing until the browser offers an install', () => {
    render(
      <AppProviders>
        <InstallPrompt />
      </AppProviders>
    );

    expect(screen.queryByText('Install Taitube')).toBeNull();
  });

  it('installs on request', async () => {
    const { prompt } = renderPrompt();

    await userEvent.click(await screen.findByRole('button', { name: 'Install' }));

    expect(prompt).toHaveBeenCalledOnce();
    expect(screen.queryByText('Install Taitube')).toBeNull();
  });

  it('goes away when dismissed', async () => {
    renderPrompt();

    await userEvent.click(await screen.findByRole('button', { name: 'Not now' }));

    expect(screen.queryByText('Install Taitube')).toBeNull();
  });
});
