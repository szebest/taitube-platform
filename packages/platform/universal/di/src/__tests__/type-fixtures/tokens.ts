import { type Token, createRegistry, provide, token } from '../../index';

const port = token<{ readonly ping: () => string }>('port');
const count = token<number>('count');

expectTypeOf(port).toEqualTypeOf<Token<{ readonly ping: () => string }>>();
expectTypeOf(provide(count, 1).value).toEqualTypeOf<number>();

// @ts-expect-error a value of another type than the token carries
provide(count, 'one');

// @ts-expect-error a value missing a member of the port
provide(port, {});

const registry = createRegistry();
const found = registry.get(count);

expectTypeOf(found).not.toBeAny();

if (found.ok) {
  expectTypeOf(found.value).toEqualTypeOf<number>();
}

// @ts-expect-error a token is not interchangeable with one of another type
const _wrong: Token<string> = count;
