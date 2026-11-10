import type { ChannelLocalization } from './channel';

/** The first locale of the negotiated chain a channel wrote a localization for. */
export function pickLocalization(
  localizations: readonly ChannelLocalization[],
  chain: readonly string[]
): ChannelLocalization | null {
  for (const locale of chain) {
    const found = localizations.find((localization) => localization.locale === locale);
    if (found) return found;
  }
  return null;
}
