import { UI_COPY_KEYS, type UiCopy, UiCopyProvider } from '@vp/ui';
import type { PropsWithChildren } from 'react';

const KEY_AS_COPY = Object.fromEntries(UI_COPY_KEYS.map((key) => [key, key])) as UiCopy;

/** The copy a primitive prints, each string its own key. */
export function WithUiCopy({ children }: PropsWithChildren) {
  return <UiCopyProvider copy={KEY_AS_COPY}>{children}</UiCopyProvider>;
}
