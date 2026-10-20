import type { PropsWithChildren } from 'react';
import { type UiCopy, UiCopyProvider } from '../copy/ui-copy';

const FIXTURE_UI_COPY: UiCopy = { close: 'Close', loading: 'Loading' };

export function WithUiCopy({ children }: PropsWithChildren) {
  return <UiCopyProvider copy={FIXTURE_UI_COPY}>{children}</UiCopyProvider>;
}
