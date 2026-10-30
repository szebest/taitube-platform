import { createCompoundContext } from '@vp/ui';

export const [SettingsSectionContext, useSettingsSection] = createCompoundContext<{
  titleId: string;
}>('SettingsSection');
