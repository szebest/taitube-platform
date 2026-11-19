import { createIntl, createIntlCache, type IntlBinding } from '@kit/intl';
import type { Clock } from '@kit/runtime';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { currentInstant, readBrowserEnvironment } from './browser-environment';
import { IntlContext, type RegisteredTranslator } from './intl-context';

/** How often "3 minutes ago" is measured again when no `now` prop pins the reference instant. */
const CLOCK_TICK_MS = 30_000;

export interface IntlProviderProps {
  /** The negotiated locale; the server render and the hydration are handed the same one. */
  readonly locale: string;
  readonly timeZone?: string;
  readonly currency?: string;
  /** Pins the instant relative times are measured from; without it the provider's clock ticks. */
  readonly now?: string;
  /** Where the provider's clock reads the time; keep it stable. */
  readonly clock: Clock;
  /** Builds the translator over the binding for `locale`, from the catalogues the app holds. */
  readonly createTranslator: (intl: IntlBinding) => RegisteredTranslator;
  readonly children: ReactNode;
}

function useTickingClock(pinned: string | undefined, initial: string, clock: Clock): string {
  const [instant, setInstant] = useState(initial);
  useEffect(() => {
    if (pinned !== undefined) return;
    const timer = setInterval(() => setInstant(currentInstant(clock)), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, [pinned, clock]);
  return pinned ?? instant;
}

export function IntlProvider({
  locale,
  timeZone,
  currency,
  now,
  clock,
  createTranslator,
  children,
}: IntlProviderProps) {
  const [environment] = useState(() => readBrowserEnvironment(clock));
  const resolvedTimeZone = timeZone ?? environment.timeZone;
  const referenceInstant = useTickingClock(now, environment.now, clock);

  const cacheForLocale = useMemo(() => ({ locale, cache: createIntlCache() }), [locale]);

  const intl = createIntl({
    locale: cacheForLocale.locale,
    timeZone: resolvedTimeZone,
    currency,
    now: referenceInstant,
    cache: cacheForLocale.cache,
  });
  const bindings = { intl, translator: createTranslator(intl) };

  return <IntlContext value={bindings}>{children}</IntlContext>;
}
