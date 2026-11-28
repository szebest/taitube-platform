import {
  type FormatFailure,
  type IntlBinding,
  localeChain,
  type PresetTable,
  type Unrenderable,
  unrenderable,
} from '@kit/intl';
import { andThen, err, ok, type Result, unwrapOr } from '@kit/result';
import type { ArgsOf, LooseCatalogue, LooseCatalogueSet, MessageKey } from './catalogue';
import { findMessage } from './catalogue';
import type { MessageKind } from './kind';
import type { AnyMessage } from './message';
import { type MessagePart, renderMessage, renderParts } from './render';

export type MissingMessage = Unrenderable & { readonly key: string };

export type MessageFailure = FormatFailure | MissingMessage;

type ArgsTuple<App, K> = keyof ArgsOf<App, K> extends never
  ? [args?: ArgsOf<App, K>]
  : [args: ArgsOf<App, K>];

export interface Translator<App> {
  t<K extends MessageKey<App>>(key: K, ...args: ArgsTuple<App, K>): Result<string, MessageFailure>;
  /** `t` as parts, for a UI that renders a list's "and N more" as more than text; joined, it is `t`. */
  parts<K extends MessageKey<App>>(
    key: K,
    ...args: ArgsTuple<App, K>
  ): Result<readonly MessagePart[], MessageFailure>;
  tOr<K extends MessageKey<App>>(key: K, args: ArgsOf<App, K>, fallback: string): string;
  /** `parts` with the arguments positional like `tOr`'s, and `fallback` for a message that cannot render. */
  partsOr<K extends MessageKey<App>>(
    key: K,
    args: ArgsOf<App, K>,
    fallback: readonly MessagePart[]
  ): readonly MessagePart[];
}

export interface TranslatorScope {
  readonly intl: IntlBinding;
  readonly catalogues: LooseCatalogueSet;
  readonly kinds: ReadonlyMap<string, MessageKind>;
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

  const find = (key: string): Result<AnyMessage, MessageFailure> => {
    const found = chain
      .map((locale) => findMessage(byLocale[locale], key))
      .find((message) => message !== undefined);
    return found === undefined ? err(missingMessage(key, chain)) : ok(found);
  };

  const render = (key: string, args: unknown): Result<string, MessageFailure> =>
    andThen(find(key), (message) => renderMessage(message, args, scope));

  return {
    t: (key, ...[args]) => render(key, args),
    parts: (key, ...[args]) => andThen(find(key), (message) => renderParts(message, args, scope)),
    partsOr: (key, args, fallback) =>
      unwrapOr(
        andThen(find(key), (message) => renderParts(message, args, scope)),
        fallback
      ),
    tOr: (key, args, fallback) => unwrapOr(render(key, args), fallback),
  };
}
