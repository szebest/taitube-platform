import { type Result, isOk } from '@vp/result';

type ViewState<T, F> = { status: 'success'; data: T } | { status: 'error'; failure: F };

export function toViewState<T, F>(result: Result<T, F>): ViewState<T, F> {
  return isOk(result)
    ? { status: 'success', data: result.value }
    : { status: 'error', failure: result.error };
}
