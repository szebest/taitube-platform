import type { Decorator } from '@storybook/react-vite';
import { accentCss } from '@vp/design-tokens';
import { en } from '@vp/messages';
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

const WORKBENCH_COPY = uiCopyFrom((key) => en.ui[key].template);

function OnDocument({ direction, children }: PropsWithChildren<{ direction: string }>) {
  const shown = useAppearance();
  const accent =
    shown.resolved.accent === null ? '' : unwrapOr(accentCss(shown.resolved.accent), '');

  useEffect(() => {
    applyAppearance(document.documentElement, shown);
    document.documentElement.dir = direction;
  }, [shown, direction]);

  return (
    <>
      {accent !== '' && <style>{accent}</style>}
      {children}
    </>
  );
}

/** Every story inside the appearance the toolbars pick, put on `<html>` as the apps' document does. */
export const withAppearance: Decorator = (Story, { globals }) => {
  const preference = preferenceFromGlobals(globals);
  return (
    <AppearanceProvider key={JSON.stringify(preference)} stored={{ preference, source: 'none' }}>
      <UiCopyProvider copy={WORKBENCH_COPY}>
        <OnDocument direction={pickOption(DIRECTIONS, globals.direction, 'ltr')}>
          <Story />
        </OnDocument>
      </UiCopyProvider>
    </AppearanceProvider>
  );
};
