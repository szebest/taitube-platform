import type { AnyFailure } from '@vp/errors';
import type { Result } from '@vp/result';

import { toViewState } from '#app/hooks/to-view-state';

export function validateWith<V>(rule: (value: V) => Result<unknown, AnyFailure>) {
  return ({ value }: { value: V }): string | undefined => {
    const view = toViewState(rule(value));
    return view.status === 'error' ? view.failure.message : undefined;
  };
}
