import { type Result, andThen, err, ok, tryCatch } from '@vp/result';
import { type FormatContext, USER, type User, resolveCurrency } from '../context';
import { type FormatFailure, describeCause, unrenderable } from '../failures';

export type DisplayNameType = Intl.DisplayNamesType;

/** `USER` names the viewer's own language, or their own currency. */
export interface DisplayNameValue {
  readonly type: 'displayName';
  readonly value: string | User;
  readonly of: DisplayNameType;
}

function resolveCode(
  value: DisplayNameValue,
  context: FormatContext
): Result<string, FormatFailure> {
  if (value.value !== USER) return ok(value.value);
  if (value.of === 'language') return ok(context.locale);
  if (value.of === 'currency') return resolveCurrency('displayName', USER, context);
  return err(unrenderable('displayName', `the viewer has no own ${value.of}`));
}

export function displayName(
  value: DisplayNameValue,
  context: FormatContext
): Result<string, FormatFailure> {
  const names = context.cache.displayNames(context.locale, { type: value.of, fallback: 'none' });
  return andThen(resolveCode(value, context), (code) =>
    andThen(names, (format) =>
      andThen(
        tryCatch(
          () => format.of(code),
          (cause) => unrenderable('displayName', describeCause(cause))
        ),
        (name) =>
          name === undefined
            ? err(unrenderable('displayName', `no ${value.of} name for ${code}`))
            : ok(name)
      )
    )
  );
}
