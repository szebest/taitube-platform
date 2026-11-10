import { Link } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { Icon } from '@vp/ui';
import { AccentRow } from '../accent-row/accent-row';
import { BuildThemeRow } from '../build-theme-row/build-theme-row';
import { DensityRow } from '../density-row/density-row';
import { ModeRow } from '../mode-row/mode-row';
import { RoundnessRow } from '../roundness-row/roundness-row';
import { SettingsSectionPage } from '../settings-section-page/settings-section-page';
import { ThemeRow } from '../theme-row/theme-row';

/** The appearance page: the choices most people make, and the way on to every token set. */
export function AppearanceSettings() {
  const { tOr } = useT();

  return (
    <SettingsSectionPage section="appearance">
      <ThemeRow />
      <ModeRow />
      <AccentRow />
      <BuildThemeRow />
      <RoundnessRow />
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
