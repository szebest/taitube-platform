import { dt } from '../define';

/** The words `@vp/ui`'s primitives print themselves, handed to its `UiCopyProvider`. */
export const ui = {
  close: dt('Close'),
  loading: dt('Loading'),
  appearance: dt('Appearance'),
  theme: dt('Theme'),
  mode: dt('Mode'),
  modeSystem: dt('System'),
  modeDark: dt('Dark'),
  modeLight: dt('Light'),
  modeOled: dt('OLED'),
} as const;
