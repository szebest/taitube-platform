import type { AnyFailure } from '@vp/errors';
import { type Result, assertNever } from '@vp/result';

import { toViewState } from '#app/hooks/to-view-state';

export function validateWith<V>(rule: (value: V) => Result<unknown, AnyFailure>) {
  return ({ value }: { value: V }): string | undefined => {
    const view = toViewState(rule(value));
    switch (view.status) {
      case 'success':
        return undefined;
      case 'error':
        return view.failure.message;
      default:
        return assertNever(view, 'validateWith view state');
    }
  };
}
