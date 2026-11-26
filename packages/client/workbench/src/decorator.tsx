import { accentCss } from '@kit/design-tokens';
import { unwrapOr } from '@kit/result';
import {
  AppearanceProvider,
  applyAppearance,
  UiCopyProvider,
  uiCopyFrom,
  useAppearance,
} from '@kit/ui';
import type { Decorator, Loader } from '@storybook/react-vite';
import { IntlProvider } from '@vp/queries/intl';
import { en, type SharedTranslation } from '@vp/shared-messages';
import { LOCALES } from '@vp/shared-messages/locales';
import { type PropsWithChildren, useEffect } from 'react';
import { STUDIO_MESSAGES } from '../../../../apps/client/studio/src/lib/messages';
import { WEB_MESSAGES } from '../../../../apps/client/web/src/lib/messages';
import { DIRECTIONS, pickOption, preferenceFromGlobals } from './toolbars';

export const pickLocale = (globals: Readonly<Record<string, unknown>>) =>
  pickOption(LOCALES.tags, globals.locale, LOCALES.source);

const isStudioStory = (title: string) => title.startsWith('Studio/');

/**
 * The toolbar locale's catalogue of the app the story belongs to (a studio story's words come from the
 * studio's), loaded before the story renders as the apps load it before they hydrate.
 */
export const loadCatalogue: Loader = async ({ globals, title }) => ({
  catalogue: await (isStudioStory(title) ? STUDIO_MESSAGES : WEB_MESSAGES).load(
    pickLocale(globals)
  ),
});

const copyFrom = (catalogue: SharedTranslation | undefined) =>
  uiCopyFrom((key) => (catalogue?.ui?.[key] ?? en.ui[key]).template);

function OnDocument({
  direction,
  lang,
  children,
}: PropsWithChildren<{ direction: string; lang: string }>) {
  const shown = useAppearance();
  const accent =
    shown.resolved.accent === null ? '' : unwrapOr(accentCss(shown.resolved.accent), '');

  useEffect(() => {
    applyAppearance(document.documentElement, shown);
    document.documentElement.dir = direction;
    document.documentElement.lang = lang;
  }, [shown, direction, lang]);

  return (
    <>
      {accent !== '' && <style>{accent}</style>}
      {children}
    </>
  );
}

const STORAGE = { cookie: 'vp.appearance', legacyCookie: 'vp.theme' };

/**
 * Every story inside the appearance, the direction and the locale the toolbars pick, put on
 * `<html>` as the apps' document does, with its app's translator and the `ui` words of that
 * locale's catalogue.
 */
export const withAppearance: Decorator = (Story, { globals, loaded, title }) => {
  const preference = preferenceFromGlobals(globals);
  const locale = pickLocale(globals);
  const catalogues = { [locale]: loaded.catalogue };
  const story = (
    <UiCopyProvider copy={copyFrom(loaded.catalogue)}>
      <OnDocument direction={pickOption(DIRECTIONS, globals.direction, 'ltr')} lang={locale}>
        <Story />
      </OnDocument>
    </UiCopyProvider>
  );
  return (
    <AppearanceProvider
      key={JSON.stringify(preference)}
      stored={{ preference, source: 'none', storage: STORAGE }}
    >
      {isStudioStory(title) ? (
        <IntlProvider
          messages={STUDIO_MESSAGES}
          locale={locale}
          catalogues={catalogues}
          timeZone="UTC"
        >
          {story}
        </IntlProvider>
      ) : (
        <IntlProvider
          messages={WEB_MESSAGES}
          locale={locale}
          catalogues={catalogues}
          timeZone="UTC"
        >
          {story}
        </IntlProvider>
      )}
    </AppearanceProvider>
  );
};
