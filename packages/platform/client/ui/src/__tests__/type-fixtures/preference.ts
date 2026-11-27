import type { TokenSetId, TokenSetIds } from '../../appearance/preference';

expectTypeOf<TokenSetId<'motion'>>().toBeString();
expectTypeOf<TokenSetIds['motion']>().toEqualTypeOf<TokenSetId<'motion'> | undefined>();
expectTypeOf<TokenSetId<'motion'>>().not.toEqualTypeOf<TokenSetId<'radius'>>();

// @ts-expect-error a group that is not a token group
type _Unknown = TokenSetId<'colour'>;
