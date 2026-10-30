import { render, screen } from '@testing-library/react';
import type { ComponentPropsWithRef } from 'react';

import { AppProviders } from '#app/__tests__/providers';
import { AppShellItem, AppShellLabel, AppShellTabItem } from '../app-shell-item';

const RouterLink = (props: ComponentPropsWithRef<'a'>) => <a {...props} />;

function renderItems(active: boolean) {
  render(
    <AppProviders>
      <ul>
        <AppShellItem icon="home" href="/" active={active}>
          <AppShellLabel>Home</AppShellLabel>
        </AppShellItem>
        <AppShellTabItem icon="explore" href="/explore" active={active}>
          Explore
        </AppShellTabItem>
        <AppShellItem icon="video" asChild>
          <RouterLink href="/studio">Studio</RouterLink>
        </AppShellItem>
      </ul>
    </AppProviders>
  );
}

describe('apps/client/web: AppShell items', () => {
  it.each([
    { active: true, current: 'page' },
    { active: false, current: null },
  ])('marks an item current when active is $active', ({ active, current }) => {
    renderItems(active);

    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBe(current);
    expect(screen.getByRole('link', { name: 'Explore' }).getAttribute('aria-current')).toBe(
      current
    );
  });

  it('draws the icon beside the label, on the caller link when it takes asChild', () => {
    renderItems(false);

    const studio = screen.getByRole('link', { name: 'Studio' });

    expect(studio).toHaveAttribute('href', '/studio');
    expect(studio.querySelector('[data-icon="video"]')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' }).querySelector('[data-icon="home"]')).not.toBe(
      null
    );
  });
});
