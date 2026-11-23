import { type LengthBounds, defineFieldFailures } from '../../index';

const failures = defineFieldFailures('INVALID_INPUT');

expectTypeOf(
  failures.invalidLength('title', { minLength: 1, maxLength: 5 }).code
).toEqualTypeOf<'INVALID_INPUT'>();
expectTypeOf(failures.invalidField('title', 'bad', { max: 5 })).toHaveProperty('code');

// @ts-expect-error the code is a string, not a number
defineFieldFailures(1);

// @ts-expect-error bounds carry both limits
failures.invalidLength('title', { minLength: 1 });

// @ts-expect-error constraints are an object
failures.invalidField('title', 'bad', 'max');

const _bounds: LengthBounds = { minLength: 1, maxLength: 5 };
