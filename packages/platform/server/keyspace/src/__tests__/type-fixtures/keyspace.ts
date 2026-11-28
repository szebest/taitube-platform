import { type KeyNamespace, defineKeyspace } from '../../index';

const keys = defineKeyspace('app', (key) => ({
  feed: key('feed'),
  user: (id: string) => key('user', id),
}));

expectTypeOf(keys.feed).toEqualTypeOf<`app:${string}`>();
expectTypeOf(keys.user).toEqualTypeOf<(id: string) => `app:${string}`>();

expectTypeOf(keys).not.toHaveProperty('missing');

// @ts-expect-error a key is a string or a function building one
defineKeyspace('app', () => ({ bad: 1 }));

// @ts-expect-error a key needs at least one part
defineKeyspace('app', (key) => ({ empty: key() }));

defineKeyspace('app', (key) => ({
  // @ts-expect-error a part is a string
  num: (id: number) => key('user', id),
}));

defineKeyspace('app', (key) => {
  expectTypeOf(key).toEqualTypeOf<KeyNamespace<'app'>>();
  return {};
});
