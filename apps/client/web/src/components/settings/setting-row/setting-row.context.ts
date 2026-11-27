import { createCompoundContext } from '@kit/ui';

export const [SettingRowContext, useSettingRow] = createCompoundContext<{
  labelId: string;
}>('SettingRow');
