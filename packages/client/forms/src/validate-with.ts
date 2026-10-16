import type { AnyFailure } from '@vp/errors';
import { type Result, isErr } from '@vp/result';

export function validateWith<V>(rule: (value: V) => Result<unknown, AnyFailure>) {
  return ({ value }: { value: V }): string | undefined => {
    const checked = rule(value);
    return isErr(checked) ? checked.error.message : undefined;
  };
}
