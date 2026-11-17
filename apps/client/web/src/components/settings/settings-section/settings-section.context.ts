import { createCompoundContext } from '@kit/ui';

export const [SettingsSectionContext, useSettingsSection] = createCompoundContext<{
  titleId: string;
}>('SettingsSection');
