import { UiCopyProvider, uiCopyFrom } from '@kit/ui';
import { useHydrated } from '@tanstack/react-router';
import type { SharedCatalogue } from '@vp/shared-messages';
import type { PropsWithChildren } from 'react';
import { type ActiveLocale, type AppMessages, FALLBACK_ACTIVE_LOCALE, IntlProvider } from './intl';
import { useT } from './intl/shared-words';

/** The placeholders a primitive fills itself, kept in the word so the catalogue owns the sentence. */
const KEPT_PLACEHOLDERS = {
  name: '{name}',
  position: '{position}',
  count: '{count}',
  tag: '{tag}',
};

function CatalogueUiCopy({ children }: PropsWithChildren) {
  const { tOr } = useT();

  const copy = uiCopyFrom((key) => tOr(`ui.${key}`, KEPT_PLACEHOLDERS, ''));

  return <UiCopyProvider copy={copy}>{children}</UiCopyProvider>;
}

export type AppWordsProps<App extends SharedCatalogue> = PropsWithChildren<{
  /** The app's catalogue, its translations and its translator provider. */
  messages: AppMessages<App>;
  /**
   * The instant the server rendered the page at: "3 seconds ago" is measured from it until the page
   * hydrates, so the hydration reads the text the server wrote, and from the browser's clock after.
   */
  renderedAt?: string;
  /** The negotiated locale and its catalogue; a spec that names none renders in `en`. */
  active?: ActiveLocale<App>;
}>;

/**
 * The locale and `@kit/ui`'s built-in words, from the `ui` section of the catalogue: the router's
 * `Wrap`, so the pending and error pages have them too, and what an app's spec providers mount.
 */
export function AppWords<App extends SharedCatalogue>({
  messages,
  renderedAt,
  active = FALLBACK_ACTIVE_LOCALE,
  children,
}: AppWordsProps<App>) {
  const hydrated = useHydrated();

  return (
    <IntlProvider
      messages={messages}
      locale={active.locale}
      catalogues={active.catalogues}
      timeZone="UTC"
      now={hydrated ? undefined : renderedAt}
    >
      <CatalogueUiCopy>{children}</CatalogueUiCopy>
    </IntlProvider>
  );
}
