import type { Clock } from '@kit/runtime';

export interface BrowserEnvironment {
  readonly timeZone: string;
  readonly now: string;
}

export function currentInstant(clock: Clock): string {
  return new Date(clock.now()).toISOString();
}

/**
 * The runtime's time zone and the app's clock, read in one place: `@kit/intl` takes both as
 * arguments, which is what lets a server render pass its own. The locale is never read here, it is
 * negotiated before the provider renders and handed to it.
 */
export function readBrowserEnvironment(clock: Clock): BrowserEnvironment {
  return {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    now: currentInstant(clock),
  };
}
