import { IntlProvider, useT } from '@vp/intl-react';
import { UiCopyProvider, uiCopyFrom } from '@vp/ui';
import type { PropsWithChildren } from 'react';

function CatalogueUiCopy({ children }: PropsWithChildren) {
  const { tOr } = useT();

  const copy = uiCopyFrom((key) => tOr(`ui.${key}`, {}, ''));

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
