import { createIntl, createIntlCache } from '@vp/intl';
import { type Catalogues, createTranslator, en } from '@vp/messages';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { currentInstant, readBrowserEnvironment } from './browser-environment';
import { IntlContext } from './intl-context';
import { resolveLocale } from './resolve-locale';

/** How often "3 minutes ago" is measured again when no `now` prop pins the reference instant. */
const CLOCK_TICK_MS = 30_000;

export interface IntlProviderProps {
  /** A server render passes the negotiated locale so the hydration agrees with it. */
  readonly locale?: string;
  readonly timeZone?: string;
  readonly currency?: string;
  /** Pins the instant relative times are measured from; without it the provider's clock ticks. */
  readonly now?: string;
  /** Translations beside `en`; keep the object stable, a new one rebuilds every binding. */
  readonly catalogues?: Omit<Catalogues, 'en'>;
  readonly children: ReactNode;
}

function useTickingClock(pinned: string | undefined, initial: string): string {
  const [clock, setClock] = useState(initial);
  useEffect(() => {
    if (pinned !== undefined) return;
    const timer = setInterval(() => setClock(currentInstant()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, [pinned]);
  return pinned ?? clock;
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
  const referenceInstant = useTickingClock(now, environment.now);

  const cacheForLocale = useMemo(
    () => ({ locale: resolvedLocale, cache: createIntlCache() }),
    [resolvedLocale]
  );

  const bindings = useMemo(() => {
    const intl = createIntl({
      locale: cacheForLocale.locale,
      timeZone: resolvedTimeZone,
      currency,
      now: referenceInstant,
      cache: cacheForLocale.cache,
    });
    return { intl, translator: createTranslator({ intl, catalogues: { ...catalogues, en } }) };
  }, [cacheForLocale, resolvedTimeZone, currency, referenceInstant, catalogues]);

  return <IntlContext.Provider value={bindings}>{children}</IntlContext.Provider>;
}
