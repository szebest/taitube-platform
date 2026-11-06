import { Link } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { Icon } from '@vp/ui';
import { AccentRow } from './accent-row';
import { BuildThemeRow } from './build-theme-row';
import { DensityRow } from './density-row';
import { ModeRow } from './mode-row';
import { SettingsSectionPage } from './settings-section-page';
import { ThemeRow } from './theme-row';

/** The appearance page: the choices most people make, and the way on to every token set. */
export function AppearanceSettings() {
  const { tOr } = useT();

  return (
    <SettingsSectionPage section="appearance">
      <ThemeRow />
      <ModeRow />
      <AccentRow />
      <BuildThemeRow />
      <DensityRow />
      <Link
        to="/settings/appearance/advanced"
        className="inline-flex items-center gap-inline p-inset-card text-label text-accent-ink touch-target focus-ring"
      >
        {tOr('settings.fineTune', {}, '')}
        <Icon name="chevron-right" size="sm" />
      </Link>
    </SettingsSectionPage>
  );
}
