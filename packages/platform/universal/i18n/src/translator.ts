import {
  type FormatFailure,
  type IntlBinding,
  localeChain,
  type Unrenderable,
  unrenderable,
} from '@vp/intl';
import { err, type Result, unwrapOr } from '@vp/result';
import type { ArgsOf, LooseCatalogue, LooseCatalogueSet, MessageKey } from './catalogue';
import { findMessage } from './catalogue';
import type { Kind } from './kind';
import type { PresetTable } from './presets';
import { renderMessage } from './render';

export type MissingMessage = Unrenderable & { readonly key: string };

export type MessageFailure = FormatFailure | MissingMessage;

type ArgsTuple<App, K> = keyof ArgsOf<App, K> extends never
  ? [args?: ArgsOf<App, K>]
  : [args: ArgsOf<App, K>];

export interface Translator<App> {
  t<K extends MessageKey<App>>(key: K, ...args: ArgsTuple<App, K>): Result<string, MessageFailure>;
  tOr<K extends MessageKey<App>>(key: K, args: ArgsOf<App, K>, fallback: string): string;
}

export interface TranslatorScope {
  readonly intl: IntlBinding;
  readonly catalogues: LooseCatalogueSet;
  readonly kinds: ReadonlyMap<string, Kind>;
  readonly presets: PresetTable;
}

function missingMessage(key: string, chain: readonly string[]): MissingMessage {
  return { ...unrenderable('t', `no message ${key} in ${chain.join(', ')}`), key };
}

/**
 * Looks each key up along the context locale's chain (`sv-FI`, `sv`, then the source locale) and
 * renders it in that same context locale. The chain is walked per key, so a partial translation
 * shows what it has and falls back for the rest.
 */
export function createTranslator<App>({
  intl,
  catalogues,
  kinds,
  presets,
}: TranslatorScope): Translator<App> {
  const ancestors = unwrapOr(localeChain(intl.context.locale), []);
  const chain = [...new Set([...ancestors, catalogues.locale])];
  const byLocale: Readonly<Record<string, LooseCatalogue>> = {
    ...catalogues.translations,
    [catalogues.locale]: catalogues.source,
  };
  const scope = { intl, kinds, presets, chain: ancestors };

  const render = (key: string, args: unknown): Result<string, MessageFailure> => {
    for (const locale of chain) {
      const message = findMessage(byLocale[locale], key);
      if (message !== undefined) return renderMessage(message, args, scope);
    }
    return err(missingMessage(key, chain));
  };

  return {
    t: (key, ...[args]) => render(key, args),
    tOr: (key, args, fallback) => unwrapOr(render(key, args), fallback),
  };
}
