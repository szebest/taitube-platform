import { useT } from '@vp/intl-react';
import { type UiCopy, UiCopyProvider } from '@vp/ui';
import type { PropsWithChildren } from 'react';

/** `@vp/ui`'s built-in words, from the `ui` section of the message catalogue; one per app root. */
export function CatalogueUiCopy({ children }: PropsWithChildren) {
  const { tOr } = useT();

  const copy: UiCopy = {
    close: tOr('ui.close', {}, ''),
    loading: tOr('ui.loading', {}, ''),
  };

  return <UiCopyProvider copy={copy}>{children}</UiCopyProvider>;
}
