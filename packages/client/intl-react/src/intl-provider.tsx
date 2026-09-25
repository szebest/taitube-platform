import { createIntl, createIntlCache } from '@vp/intl';
import { type Catalogues, createTranslator, en } from '@vp/messages';
import { type ReactNode, useMemo, useState } from 'react';
import { readBrowserEnvironment } from './browser-environment';
import { IntlContext } from './intl-context';
import { resolveLocale } from './resolve-locale';

export interface IntlProviderProps {
  /** A server render passes the negotiated locale so the hydration agrees with it. */
  readonly locale?: string;
  readonly timeZone?: string;
  readonly currency?: string;
  /** The instant relative times are measured from; a server render passes the one it used. */
  readonly now?: string;
  /** Translations beside `en`; keep the object stable, a new one rebuilds every binding. */
  readonly catalogues?: Omit<Catalogues, 'en'>;
  readonly children: ReactNode;
}

export function IntlProvider({
  locale,
  timeZone,
  currency,
  now,
  catalogues,
  children,
}: IntlProviderProps) {
  const [environment] = useState(readBrowserEnvironment);
  const resolvedLocale = resolveLocale({
    explicit: locale,
    persisted: environment.persistedLocale,
    languages: environment.languages,
  });
  const resolvedTimeZone = timeZone ?? environment.timeZone;
  const referenceInstant = now ?? environment.now;

  const bindings = useMemo(() => {
    const intl = createIntl({
      locale: resolvedLocale,
      timeZone: resolvedTimeZone,
      currency,
      now: referenceInstant,
      cache: createIntlCache(),
    });
    return { intl, translator: createTranslator({ intl, catalogues: { ...catalogues, en } }) };
  }, [resolvedLocale, resolvedTimeZone, currency, referenceInstant, catalogues]);

  return <IntlContext.Provider value={bindings}>{children}</IntlContext.Provider>;
}
