import {
  type AnyFailure,
  type AnyInputFailure,
  type Failure,
  type InputFailure,
  failurePayload,
  isInputFailure,
} from '../../failure';

type Missing = Failure<'MISSING', { id: string }>;
type TooLong = InputFailure<'TOO_LONG', { max: number }>;

expectTypeOf<Missing>().toEqualTypeOf<
  Readonly<{ code: 'MISSING'; message: string } & { id: string }>
>();
expectTypeOf<TooLong['field']>().toEqualTypeOf<string>();
expectTypeOf<TooLong['code']>().toEqualTypeOf<'TOO_LONG'>();
expectTypeOf<Missing>().toExtend<AnyFailure<'MISSING'>>();
expectTypeOf<TooLong>().toExtend<AnyInputFailure<'TOO_LONG'>>();

declare const missing: Missing;
declare const tooLong: TooLong;
declare const anyFailure: AnyFailure<'MISSING' | 'TOO_LONG'>;

failurePayload(tooLong);

// @ts-expect-error a failure that names no field cannot reach the wire
failurePayload(missing);

if (isInputFailure(anyFailure)) {
  expectTypeOf(anyFailure).toEqualTypeOf<AnyInputFailure<'MISSING' | 'TOO_LONG'>>();
  expectTypeOf(anyFailure.field).toEqualTypeOf<string>();
}

// @ts-expect-error an input failure carries the field of its input
const _noField: InputFailure<'TOO_LONG'> = { code: 'TOO_LONG', message: 'long' };
