import type { Decorator, Loader } from '@storybook/react-vite';
import { accentCss } from '@vp/design-tokens';
import { FALLBACK_LOCALE } from '@vp/intl';
import { type Catalogues, en, LOCALE_DETAILS, SUPPORTED_LOCALES } from '@vp/messages';
import { unwrapOr } from '@vp/result';
import {
  AppearanceProvider,
  applyAppearance,
  UiCopyProvider,
  uiCopyFrom,
  useAppearance,
} from '@vp/ui';
import { type PropsWithChildren, useEffect } from 'react';
import { DIRECTIONS, pickOption, preferenceFromGlobals } from './toolbars';

type Translation = Catalogues[string];

const pickLocale = (globals: Readonly<Record<string, unknown>>) =>
  pickOption(SUPPORTED_LOCALES, globals.locale, FALLBACK_LOCALE);

/** The toolbar locale's catalogue, loaded before the story renders as the apps load it before they hydrate. */
export const loadCatalogue: Loader = async ({ globals }) => ({
  catalogue: await LOCALE_DETAILS[pickLocale(globals)].load(),
});

const copyFrom = (catalogue: Translation | undefined) =>
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

/**
 * Every story inside the appearance, the direction and the locale the toolbars pick, put on
 * `<html>` as the apps' document does, with the `ui` words of that locale's catalogue.
 */
export const withAppearance: Decorator = (Story, { globals, loaded }) => {
  const preference = preferenceFromGlobals(globals);
  return (
    <AppearanceProvider key={JSON.stringify(preference)} stored={{ preference, source: 'none' }}>
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
