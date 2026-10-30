import { BordersRow, ContrastRow, FontSizeRow, MotionRow } from './accessibility-appearance-rows';
import { CaptionsLanguageRow, CaptionsRow } from './captions-rows';
import { SettingsSectionPage } from './settings-section-page';

/** Reading and motion settings, written as the same appearance overrides the advanced page holds. */
export function AccessibilitySettings() {
  return (
    <SettingsSectionPage section="accessibility">
      <FontSizeRow />
      <ContrastRow />
      <MotionRow />
      <BordersRow />
      <CaptionsRow />
      <CaptionsLanguageRow />
    </SettingsSectionPage>
  );
}
