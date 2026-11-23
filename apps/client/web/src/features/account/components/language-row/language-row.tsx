import { Select } from '@kit/ui';
import { useRouteContext, useRouter } from '@tanstack/react-router';
import { LOCALES } from '@vp/shared-messages/locales';
import { useT } from '#app/lib/messages';
import { useLocalePreference } from '#app/lib/preferences/device-preferences-provider';
import { SettingItem } from '../setting-item/setting-item';

const BROWSER = 'auto';

/**
 * The language the viewer reads in, kept on this device. Each language is named in itself, the
 * browser's own one beside "follow my browser"; a tag the cookie holds that the list lacks stays
 * chosen. A choice re-runs the root route's negotiation, which re-renders the app in place.
 */
export function LanguageRow() {
  const [locale, setLocale] = useLocalePreference();
  const router = useRouter();
  const browserLocale = useRouteContext({
    from: '__root__',
    select: (context) => context.browserLocale,
  });
  const { tOr } = useT();

  const unlisted = locale !== null && !LOCALES.tags.some((listed) => listed === locale);
  const followBrowser =
    browserLocale === undefined
      ? tOr('settings.followBrowser', {}, '')
      : tOr('settings.followBrowserIn', { name: LOCALES.details[browserLocale].name }, '');

  const choose = (next: string) => {
    setLocale(next === BROWSER ? null : next);
    void router.invalidate();
  };

  return (
    <SettingItem
      row="language"
      description={tOr('settings.rowDescription', { row: 'language' }, '')}
    >
      <Select.Root value={locale ?? BROWSER} onValueChange={choose}>
        <Select.Trigger aria-label={tOr('settings.rowLabel', { row: 'language' }, '')}>
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value={BROWSER}>{followBrowser}</Select.Item>
          {LOCALES.tags.map((tag) => (
            <Select.Item key={tag} value={tag} lang={tag}>
              {LOCALES.details[tag].name}
            </Select.Item>
          ))}
          {unlisted && <Select.Item value={locale}>{locale}</Select.Item>}
        </Select.Content>
      </Select.Root>
    </SettingItem>
  );
}
