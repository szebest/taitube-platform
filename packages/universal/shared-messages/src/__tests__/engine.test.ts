import { createRegistry } from '@kit/di';
import { FormatPresets } from '@kit/intl';
import { describePresetsContract } from '@kit/intl/contract';
import { sharedI18n } from '../catalogue';
import { en } from '../en';

describePresetsContract(() => {
  const registry = createRegistry().provide(
    ...sharedI18n.providers({ locale: 'en', source: en, translations: {} })
  );
  const presets = registry.get(FormatPresets);
  if (!presets.ok) {
    throw new Error(presets.error.token);
  }
  return presets.value;
});
