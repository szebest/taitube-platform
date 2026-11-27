import { type TokenSet, defineTokenSet, parseTokenSet } from '../../index';

type RadiusValues = Parameters<typeof defineTokenSet<'radius', 'soft'>>[2];
declare const radius: RadiusValues;

const set = defineTokenSet('radius', 'soft', radius);

expectTypeOf(set).toEqualTypeOf<TokenSet<'radius', 'soft'>>();
expectTypeOf(set.id).toEqualTypeOf<'soft'>();

// @ts-expect-error a group that is not a token group
defineTokenSet('colour', 'soft', radius);

// @ts-expect-error values of another group
defineTokenSet('spacing', 'soft', radius);

// @ts-expect-error a group that is not a token group
parseTokenSet('colour', {});
