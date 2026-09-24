import { ignore } from '../../combinators';
import { err } from '../../result';

const failed = err({ code: 'GONE' as const });

function _spelledOut(): void {
  ignore(failed, 'progress is advisory');
}

function _fromAVariable(reason: string): void {
  // @ts-expect-error a reason held in a variable could say anything, so it justifies nothing
  ignore(failed, reason);
}

function _empty(): void {
  // @ts-expect-error an empty reason is no reason
  ignore(failed, '');
}

function _notAResult(): void {
  // @ts-expect-error only a Result, settled or pending, is dropped through ignore
  ignore(42, 'a number is not a result');
}
