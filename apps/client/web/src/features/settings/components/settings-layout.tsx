import { Link, Outlet, useLocation } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { Icon } from '@vp/ui';

import { SettingsShell } from '#app/components/settings/settings-shell';
import { SETTINGS_SECTION_IDS, SETTINGS_SECTIONS } from '../settings-index';

/** The `/settings` layout: the section navigation beside the page from medium up, the page alone on compact. */
export function SettingsLayout() {
  const { tOr } = useT();
  const pathname = useLocation({ select: ({ pathname: current }) => current });

  return (
    <SettingsShell.Root>
      <SettingsShell.Nav aria-label={tOr('settings.navLabel', {}, '')}>
        <SettingsShell.NavList>
          {SETTINGS_SECTION_IDS.filter((id) => SETTINGS_SECTIONS[id].inNav).map((id) => {
            const { to, icon } = SETTINGS_SECTIONS[id];

            return (
              <SettingsShell.NavItem key={id} asChild active={pathname.startsWith(to)}>
                <Link to={to}>
                  <Icon name={icon} size="md" />
                  {tOr('settings.sectionTitle', { section: id }, '')}
                </Link>
              </SettingsShell.NavItem>
            );
          })}
        </SettingsShell.NavList>
      </SettingsShell.Nav>
      <SettingsShell.Pane>
        <Outlet />
      </SettingsShell.Pane>
    </SettingsShell.Root>
  );
}
