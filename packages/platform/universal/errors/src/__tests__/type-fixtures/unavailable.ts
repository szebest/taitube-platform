import { type Unavailable, unavailable } from '../../unavailable';

const cacheDown = unavailable('CACHE_UNAVAILABLE', 'The cache did not answer.');

expectTypeOf(cacheDown('get')).toEqualTypeOf<Unavailable<'CACHE_UNAVAILABLE'>>();
expectTypeOf(cacheDown('get').code).toEqualTypeOf<'CACHE_UNAVAILABLE'>();
expectTypeOf(cacheDown.during('get')).toEqualTypeOf<
  (cause: unknown) => Unavailable<'CACHE_UNAVAILABLE'>
>();

// @ts-expect-error an operation is named
cacheDown();

// @ts-expect-error a code is a string
unavailable(1, 'down');
