import { createCompoundContext } from '@vp/ui';

export const [SettingRowContext, useSettingRow] = createCompoundContext<{
  labelId: string;
}>('SettingRow');
