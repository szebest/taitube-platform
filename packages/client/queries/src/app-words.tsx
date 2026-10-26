import { IntlProvider, useT } from '@vp/intl-react';
import { UiCopyProvider, uiCopyFrom } from '@vp/ui';
import type { PropsWithChildren } from 'react';

/** The placeholders a primitive fills itself, kept in the word so the catalogue owns the sentence. */
const KEPT_PLACEHOLDERS = { name: '{name}', position: '{position}', count: '{count}' };

function CatalogueUiCopy({ children }: PropsWithChildren) {
  const { tOr } = useT();

  const copy = uiCopyFrom((key) => tOr(`ui.${key}`, KEPT_PLACEHOLDERS, ''));

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
