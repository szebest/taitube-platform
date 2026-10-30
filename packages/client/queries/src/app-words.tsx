import { useHydrated } from '@tanstack/react-router';
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

export type AppWordsProps = PropsWithChildren<{
  /**
   * The instant the server rendered the page at: "3 seconds ago" is measured from it until the page
   * hydrates, so the hydration reads the text the server wrote, and from the browser's clock after.
   */
  renderedAt?: string;
}>;

/**
 * The locale and `@vp/ui`'s built-in words, from the `ui` section of the catalogue: the router's
 * `Wrap`, so the pending and error pages have them too, and what an app's spec providers mount.
 */
export function AppWords({ renderedAt, children }: AppWordsProps) {
  const hydrated = useHydrated();

  return (
    <IntlProvider locale="en" timeZone="UTC" now={hydrated ? undefined : renderedAt}>
      <CatalogueUiCopy>{children}</CatalogueUiCopy>
    </IntlProvider>
  );
}
