import { defineKeyspace } from '../keyspace';

const Keys = defineKeyspace('acme', (key) => ({
  catalogue: key('cache', 'catalogue', 'v1'),
  basket: (userId: string) => key('user', userId, 'basket'),
}));

describe('@kit/keyspace: defineKeyspace', () => {
  it.each([
    { scenario: 'a fixed key', built: Keys.catalogue, expected: 'acme:cache:catalogue:v1' },
    {
      scenario: 'a key with a parameter',
      built: Keys.basket('u-1'),
      expected: 'acme:user:u-1:basket',
    },
  ])('joins $scenario under the namespace', ({ built, expected }) => {
    expect(built).toBe(expected);
  });

  it('lays the same keys under another namespace without sharing one with the first', () => {
    const layout = (namespace: string) =>
      defineKeyspace(namespace, (key) => ({ catalogue: key('cache', 'catalogue', 'v1') }));

    expect([layout('acme').catalogue, layout('globex').catalogue]).toEqual([
      'acme:cache:catalogue:v1',
      'globex:cache:catalogue:v1',
    ]);
  });

  it('freezes the layout it returns', () => {
    expect(Object.isFrozen(Keys)).toBe(true);
  });

  it('types every key with its namespace', () => {
    expectTypeOf(Keys.catalogue).toEqualTypeOf<`acme:${string}`>();
    expectTypeOf(Keys.basket).returns.toEqualTypeOf<`acme:${string}`>();
  });

  it('refuses a key with no part', () => {
    defineKeyspace('acme', (key) => ({
      // @ts-expect-error a key names at least one part after the namespace
      bare: key(),
    }));
  });
});
