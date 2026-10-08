import { type AnyFailure, isInputFailure } from '@vp/errors';
import { type Result, isOk } from '@vp/result';

type ViewState<T, F extends AnyFailure> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; failure: F; fieldErrors: Readonly<Record<string, string>> };

export type SettledViewState<T, F extends AnyFailure> = Extract<
  ViewState<T, F>,
  { status: 'success' | 'error' }
>;

function fieldErrorsOf(failure: AnyFailure): Readonly<Record<string, string>> {
  return isInputFailure(failure) ? { [failure.field]: failure.message } : {};
}

export function toViewState<T, F extends AnyFailure>(result: Result<T, F>): SettledViewState<T, F> {
  if (isOk(result)) return { status: 'success', data: result.value };
  return { status: 'error', failure: result.error, fieldErrors: fieldErrorsOf(result.error) };
}
