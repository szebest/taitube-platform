import { type Result, andThen, err, ok, tryCatch } from '@kit/result';
import { type FormatContext, USER, type User, resolveCurrency } from '../context';
import { type FormatFailure, unrenderable } from '../failures';
import { type OptionKeys, type TaggedOf, defineKind, optionKeys } from '../kind';

const DISPLAY_NAME_OPTION_KEYS = [
  'of',
  'style',
  'languageDisplay',
] as const satisfies OptionKeys<DisplayNameOptions>;

export interface DisplayNameOptions {
  readonly of: Intl.DisplayNamesType;
  readonly style?: Intl.DisplayNamesOptions['style'];
  readonly languageDisplay?: Intl.DisplayNamesOptions['languageDisplay'];
}

const isCode = (value: unknown): value is string | User => typeof value === 'string';

function resolveCode(
  code: string | User,
  of: Intl.DisplayNamesType,
  context: FormatContext
): Result<string, FormatFailure> {
  if (code !== USER) return ok(code);
  if (of === 'language') return ok(context.locale);
  if (of === 'currency') return resolveCurrency('displayName', USER, context);
  return err(unrenderable('displayName', `the viewer has no own ${of}`));
}

/** `USER` names the viewer's own language, or their own currency. */
export const displayName = defineKind({
  name: 'displayName',
  arg: isCode,
  options: optionKeys<DisplayNameOptions>(DISPLAY_NAME_OPTION_KEYS),
  render: (value, options, context) => {
    if (options === undefined) return err(unrenderable('displayName', 'no type of name given'));
    const { of, ...display } = options;
    const names = context.cache.displayNames(context.locale, {
      ...display,
      type: of,
      fallback: 'none',
    });
    return andThen(resolveCode(value, of, context), (code) =>
      andThen(names, (format) =>
        andThen(
          tryCatch(
            () => format.of(code),
            (cause) => unrenderable('displayName', String(cause))
          ),
          (name) =>
            name === undefined
              ? err(unrenderable('displayName', `no ${of} name for ${code}`))
              : ok(name)
        )
      )
    );
  },
});

/** @public */
export type DisplayNameValue = TaggedOf<typeof displayName>;
