import { IntlProvider, useT } from '@vp/intl-react';
import { type UiCopy, UiCopyProvider } from '@vp/ui';
import type { PropsWithChildren } from 'react';

function CatalogueUiCopy({ children }: PropsWithChildren) {
  const { tOr } = useT();

  const copy: UiCopy = {
    close: tOr('ui.close', {}, ''),
    loading: tOr('ui.loading', {}, ''),
  };

  return <UiCopyProvider copy={copy}>{children}</UiCopyProvider>;
}

/**
 * The locale and `@vp/ui`'s built-in words, from the `ui` section of the catalogue: the router's
 * `Wrap`, so the pending and error pages have them too, and what an app's spec providers mount.
 */
export function AppWords({ children }: PropsWithChildren) {
  return (
    <IntlProvider locale="en" timeZone="UTC">
      <CatalogueUiCopy>{children}</CatalogueUiCopy>
    </IntlProvider>
  );
}
