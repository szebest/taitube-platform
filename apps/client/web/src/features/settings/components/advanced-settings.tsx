import { TOKEN_GROUPS } from '@vp/design-tokens';
import { useT } from '@vp/intl-react';
import { Button, useAppearance } from '@vp/ui';

import { AdvancedPreviewPanel } from './advanced-preview-panel';
import { SettingsSectionPage } from './settings-section-page';
import { TokenGroupRow } from './token-group-row';

function ResetAll() {
  const { preference, resetOverrides } = useAppearance();
  const { tOr } = useT();
  const changed = Object.values(preference.overrides).some((id) => id !== undefined);

  return (
    <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-inline tw:p-inset-card">
      {!changed && (
        <span className="tw:text-body-sm tw:text-fg-muted">
          {tOr('settings.nothingChanged', {}, '')}
        </span>
      )}
      <Button
        className="tw:ms-auto"
        variant="outline"
        disabled={!changed}
        onClick={() => resetOverrides()}
      >
        {tOr('settings.resetAll', {}, '')}
      </Button>
    </div>
  );
}

/** The fine-tune page: every token group the registry offers, one row each, beside a preview of the whole. */
export function AdvancedSettings() {
  return (
    <SettingsSectionPage section="advanced" aside={<AdvancedPreviewPanel />}>
      <ResetAll />
      {TOKEN_GROUPS.map((group) => (
        <TokenGroupRow key={group} group={group} />
      ))}
    </SettingsSectionPage>
  );
}
