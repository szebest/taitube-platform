import { render, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';

import { SettingsShell } from '..';

const renderShell = () =>
  render(
    <SettingsShell.Root>
      <SettingsShell.Nav aria-label="Settings sections">
        <SettingsShell.NavList>
          <SettingsShell.NavItem active href="/settings/appearance">
            Appearance
          </SettingsShell.NavItem>
          <SettingsShell.NavItem href="/settings/playback">Playback</SettingsShell.NavItem>
        </SettingsShell.NavList>
      </SettingsShell.Nav>
      <SettingsShell.Pane>
        <SettingsShell.Back href="/settings">Settings</SettingsShell.Back>
      </SettingsShell.Pane>
    </SettingsShell.Root>
  );

describe('SettingsShell', () => {
  it('marks the section on screen as the current page', () => {
    renderShell();

    expect(screen.getByRole('link', { name: 'Appearance', hidden: true })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('link', { name: 'Playback', hidden: true })).not.toHaveAttribute(
      'aria-current'
    );
  });

  it('passes axe', async () => {
    renderShell();

    expect(await axeViolations()).toEqual([]);
  });
});
