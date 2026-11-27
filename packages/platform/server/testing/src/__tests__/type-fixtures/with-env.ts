import { withEnv } from '../../index';

expectTypeOf(withEnv({ A: '1' }, () => 1)).toEqualTypeOf<Promise<number>>();
expectTypeOf(withEnv({ A: undefined }, async () => 'x')).toEqualTypeOf<Promise<string>>();

// @ts-expect-error an env value is a string or undefined
withEnv({ A: 1 }, () => 1);
