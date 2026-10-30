import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AppProviders } from '#app/__tests__/providers';
import { AppShellRoot } from '../app-shell';
import { AppShellHeader, AppShellSearchTrigger } from '../app-shell-header';

function renderHeader() {
  const onRailStateChange = vi.fn();
  render(
    <AppProviders>
      <AppShellRoot railState="open" onRailStateChange={onRailStateChange}>
        <AppShellHeader
          logo={<a href="/">Taitube</a>}
          search={<AppShellSearchTrigger>Search</AppShellSearchTrigger>}
          actions={<button type="button">Upload</button>}
          account={<button type="button">Account</button>}
        />
      </AppShellRoot>
    </AppProviders>
  );
  return { user: userEvent.setup(), onRailStateChange };
}

describe('apps/client/web: AppShellHeader', () => {
  it('shows the logo, the search, then the actions and the account', () => {
    renderHeader();

    const names = [...screen.getByRole('banner').querySelectorAll('a, button')].map(
      (element) => element.textContent || element.getAttribute('aria-label')
    );

    expect(names).toEqual(['Menu', 'Taitube', 'Search/', 'Upload', 'Account']);
  });

  it('names the search trigger as a dialog opener with its shortcuts', () => {
    renderHeader();

    const search = screen.getByRole('button', { name: 'Search' });

    expect(search).toHaveAttribute('aria-haspopup', 'dialog');
    expect(search).toHaveAttribute('aria-keyshortcuts', '/ Control+K Meta+K');
  });
});
