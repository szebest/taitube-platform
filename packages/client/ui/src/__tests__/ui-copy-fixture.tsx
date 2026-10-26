import type { PropsWithChildren } from 'react';
import { type UiCopy, UiCopyProvider } from '../copy/ui-copy';

export const FIXTURE_UI_COPY: UiCopy = {
  close: 'Close',
  loading: 'Loading',
  required: 'required',
  noResults: 'No results',
  reorder: 'Reorder {name}',
  pickedUp: 'Picked up {name}, position {position} of {count}',
  movedTo: 'Moved to position {position}',
  droppedAt: 'Dropped at position {position}',
  cancelled: 'Cancelled',
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
  retry: 'Try again',
  breadcrumb: 'Breadcrumb',
  menu: 'Menu',
  skipToContent: 'Skip to content',
  navigation: 'Main',
};

export function WithUiCopy({ children }: PropsWithChildren) {
  return <UiCopyProvider copy={FIXTURE_UI_COPY}>{children}</UiCopyProvider>;
}
