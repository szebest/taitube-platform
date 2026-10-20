import type { Decorator } from '@storybook/react-vite';
import { accentCss } from '@vp/design-tokens';
import { en } from '@vp/messages';
import { unwrapOr } from '@vp/result';
import {
  AppearanceProvider,
  applyAppearance,
  type UiCopy,
  UiCopyProvider,
  useAppearance,
} from '@vp/ui';
import { type PropsWithChildren, useEffect } from 'react';
import { DIRECTIONS, pickOption, preferenceFromGlobals } from './toolbars';

const WORKBENCH_COPY: UiCopy = {
  close: en.ui.close.template,
  loading: en.ui.loading.template,
  appearance: en.ui.appearance.template,
  theme: en.ui.theme.template,
  mode: en.ui.mode.template,
  modeSystem: en.ui.modeSystem.template,
  modeDark: en.ui.modeDark.template,
  modeLight: en.ui.modeLight.template,
  modeOled: en.ui.modeOled.template,
  density: en.ui.density.template,
  densityComfortable: en.ui.densityComfortable.template,
  densityCompact: en.ui.densityCompact.template,
};

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
