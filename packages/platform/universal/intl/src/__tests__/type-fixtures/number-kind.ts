import { type Scaled, scale } from '../../number-kind';

expectTypeOf(scale(2048, 1024, ['byte', 'kilobyte'])).toEqualTypeOf<Scaled<'byte' | 'kilobyte'>>();
expectTypeOf(scale(1, 1000, ['a', 'b', 'c']).unit).toEqualTypeOf<'a' | 'b' | 'c'>();

// @ts-expect-error the units are a non-empty list
scale(1, 1000, []);

// @ts-expect-error a unit is a string
scale(1, 1000, [1]);
