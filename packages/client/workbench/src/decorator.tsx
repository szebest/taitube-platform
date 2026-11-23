import { accentCss } from '@kit/design-tokens';
import { FALLBACK_LOCALE } from '@kit/intl';
import { unwrapOr } from '@kit/result';
import {
  AppearanceProvider,
  applyAppearance,
  UiCopyProvider,
  uiCopyFrom,
  useAppearance,
} from '@kit/ui';
import type { Decorator, Loader } from '@storybook/react-vite';
import { en, SUPPORTED_LOCALES, type SharedTranslation } from '@vp/shared-messages';
import { type PropsWithChildren, useEffect } from 'react';
import { WEB_MESSAGES } from '../../../../apps/client/web/src/lib/messages';
import { DIRECTIONS, pickOption, preferenceFromGlobals } from './toolbars';

export const pickLocale = (globals: Readonly<Record<string, unknown>>) =>
  pickOption(SUPPORTED_LOCALES, globals.locale, FALLBACK_LOCALE);

/** The toolbar locale's catalogue, loaded before the story renders as the apps load it before they hydrate. */
export const loadCatalogue: Loader = async ({ globals }) => ({
  catalogue: await WEB_MESSAGES.load(pickLocale(globals)),
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
 * `<html>` as the apps' document does, with the `ui` words of that locale's catalogue.
 */
export const withAppearance: Decorator = (Story, { globals, loaded }) => {
  const preference = preferenceFromGlobals(globals);
  return (
    <AppearanceProvider
      key={JSON.stringify(preference)}
      stored={{ preference, source: 'none', storage: STORAGE }}
    >
      <UiCopyProvider copy={copyFrom(loaded.catalogue)}>
        <OnDocument
          direction={pickOption(DIRECTIONS, globals.direction, 'ltr')}
          lang={pickLocale(globals)}
        >
          <Story />
        </OnDocument>
      </UiCopyProvider>
    </AppearanceProvider>
  );
};
