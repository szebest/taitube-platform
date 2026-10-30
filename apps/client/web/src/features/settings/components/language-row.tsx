import { FALLBACK_LOCALE } from '@vp/intl';
import { useT } from '@vp/intl-react';
import { Select } from '@vp/ui';

import { useLocalePreference } from '../device/device-preferences-provider';
import { SettingItem } from './setting-item';

const LOCALES = [FALLBACK_LOCALE] as const;

const BROWSER = 'auto';

/** The language the viewer reads in, kept on this device; a tag the cookie holds that the list lacks stays chosen. */
export function LanguageRow() {
  const [locale, setLocale] = useLocalePreference();
  const { tOr } = useT();
  const unlisted = locale !== null && !LOCALES.some((listed) => listed === locale);

  return (
    <SettingItem
      row="language"
      description={tOr('settings.rowDescription', { row: 'language' }, '')}
    >
      <Select.Root
        value={locale ?? BROWSER}
        onValueChange={(next) => setLocale(next === BROWSER ? null : next)}
      >
        <Select.Trigger aria-label={tOr('settings.rowLabel', { row: 'language' }, '')}>
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value={BROWSER}>
            {tOr('settings.localeOption', { locale: BROWSER }, '')}
          </Select.Item>
          {LOCALES.map((tag) => (
            <Select.Item key={tag} value={tag}>
              {tOr('settings.localeOption', { locale: tag }, '')}
            </Select.Item>
          ))}
          {unlisted && <Select.Item value={locale}>{locale}</Select.Item>}
        </Select.Content>
      </Select.Root>
    </SettingItem>
  );
}
