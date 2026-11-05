export interface BrowserEnvironment {
  readonly timeZone: string;
  readonly now: string;
}

export function currentInstant(): string {
  return new Date().toISOString();
}

/**
 * The runtime's time zone and clock, read in one place: `@vp/intl` takes both as arguments, which
 * is what lets a server render pass its own. The locale is never read here, it is negotiated
 * before the provider renders and handed to it.
 */
export function readBrowserEnvironment(): BrowserEnvironment {
  return {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    now: currentInstant(),
  };
}
