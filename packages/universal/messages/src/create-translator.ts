import { ErrorCodes } from '@vp/errors';
import {
  FALLBACK_LOCALE,
  type FormatFailure,
  type IntlBinding,
  type Unrenderable,
  localeChain,
} from '@vp/intl';
import { type Result, err, unwrapOr } from '@vp/result';
import { type ArgsOf, type Catalogues, type MessageKey, findMessage } from './catalogue';
import { substitute } from './substitute';

type MissingMessage = Unrenderable & { readonly key: string };

type MessageFailure = FormatFailure | MissingMessage;

type ArgsTuple<K extends MessageKey> = keyof ArgsOf<K> extends never
  ? [args?: ArgsOf<K>]
  : [args: ArgsOf<K>];

export interface Translator {
  t<K extends MessageKey>(key: K, ...args: ArgsTuple<K>): Result<string, MessageFailure>;
  tOr<K extends MessageKey>(key: K, args: ArgsOf<K>, fallback: string): string;
}

export interface TranslatorDeps {
  readonly intl: IntlBinding;
  readonly catalogues: Catalogues;
}

function missingMessage(key: string, chain: readonly string[]): MissingMessage {
  return {
    code: ErrorCodes.FORMAT_UNRENDERABLE,
    message: `No message ${key} in ${chain.join(', ')}`,
    formatter: 't',
    reason: 'missing message',
    key,
  };
}

/**
 * Looks each key up along the context locale's chain (`sv-FI`, `sv`, `en`) and formats its
 * placeholders in that same context locale. The chain is walked per key, so a partial
 * translation shows what it has and falls back for the rest.
 */
export function createTranslator({ intl, catalogues }: TranslatorDeps): Translator {
  const chain = unwrapOr(localeChain(intl.context.locale), [FALLBACK_LOCALE]);

  const render = (
    key: MessageKey,
    args: Readonly<Record<string, unknown>> = {}
  ): Result<string, MessageFailure> => {
    for (const locale of chain) {
      const message = findMessage(catalogues[locale], key);
      if (message !== undefined) return substitute(message, args, intl);
    }
    return err(missingMessage(key, chain));
  };

  return {
    t: (key, ...[args]) => render(key, args),
    tOr: (key, args, fallback) => unwrapOr(render(key, args), fallback),
  };
}
