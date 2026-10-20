import type { PropsWithChildren } from 'react';
import { type UiCopy, UiCopyProvider } from '../copy/ui-copy';

export const FIXTURE_UI_COPY: UiCopy = {
  close: 'Close',
  loading: 'Loading',
  appearance: 'Appearance',
  theme: 'Theme',
  mode: 'Mode',
  modeSystem: 'System',
  modeDark: 'Dark',
  modeLight: 'Light',
  modeOled: 'OLED',
  density: 'Density',
  densityComfortable: 'Comfortable',
  densityCompact: 'Compact',
};

export function WithUiCopy({ children }: PropsWithChildren) {
  return <UiCopyProvider copy={FIXTURE_UI_COPY}>{children}</UiCopyProvider>;
}
