import { Link } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { useAccount } from '@vp/queries';
import type { PropsWithChildren } from 'react';

import { SettingsSection } from '#app/components/settings/settings-section';
import { SettingsShell } from '#app/components/settings/settings-shell';
import { SETTINGS_SECTIONS, type SettingsSectionId } from '../settings-index';
import { SettingsSignIn } from './settings-sign-in';

export type SettingsSectionPageProps = PropsWithChildren<{ section: SettingsSectionId }>;

/**
 * A settings page: the way back to the list, the section's heading and its rows. A section the
 * account holds asks a guest to sign in instead; a page with no rows yet says so.
 */
export function SettingsSectionPage({ section, children }: SettingsSectionPageProps) {
  const { tOr } = useT();
  const account = useAccount();
  const { account: accountOnly, parent } = SETTINGS_SECTIONS[section];
  const back = parent ? SETTINGS_SECTIONS[parent] : undefined;

  return (
    <>
      <SettingsShell.Back asChild>
        {back && parent ? (
          <Link to={back.to}>{tOr('settings.sectionTitle', { section: parent }, '')}</Link>
        ) : (
          <Link to="/settings">{tOr('settings.title', {}, '')}</Link>
        )}
      </SettingsShell.Back>
      <SettingsSection.Root>
        <SettingsSection.Title asChild>
          <h1>{tOr('settings.sectionTitle', { section }, '')}</h1>
        </SettingsSection.Title>
        <SettingsSection.Description>
          {tOr('settings.sectionSummary', { section }, '')}
        </SettingsSection.Description>
        {accountOnly && !account ? (
          <SettingsSignIn />
        ) : (
          <SettingsSection.Body>
            {children ?? (
              <p className="tw:m-0 tw:p-inset-card tw:text-fg-muted">
                {tOr('settings.sectionEmpty', {}, '')}
              </p>
            )}
          </SettingsSection.Body>
        )}
      </SettingsSection.Root>
    </>
  );
}
