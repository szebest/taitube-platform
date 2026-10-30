import { Link } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { useAccount } from '@vp/queries';
import type { PropsWithChildren, ReactNode } from 'react';

import { SettingsSection } from '#app/components/settings/settings-section';
import { SettingsShell } from '#app/components/settings/settings-shell';
import { SETTINGS_SECTIONS, type SettingsSectionId } from '../settings-index';
import { SettingsSignIn } from './settings-sign-in';

export type SettingsSectionPageProps = PropsWithChildren<{
  section: SettingsSectionId;
  /** What sits beside the rows from the expanded width up, and under them below it. */
  aside?: ReactNode;
}>;

/**
 * A settings page: the way back to the list, the section's heading and its rows. A section the
 * account holds asks a guest to sign in instead.
 */
export function SettingsSectionPage({ section, aside, children }: SettingsSectionPageProps) {
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
          <div
            className={
              aside
                ? 'tw:grid tw:items-start tw:gap-section tw:expanded:grid-cols-[minmax(0,1fr)_20rem]'
                : undefined
            }
          >
            <SettingsSection.Body>{children}</SettingsSection.Body>
            {aside}
          </div>
        )}
      </SettingsSection.Root>
    </>
  );
}
