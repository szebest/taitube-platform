import { Container, token } from '../../index';

const count = token<number>('count');
const label = token<string>('label');

const container = new Container().provide(count, () => 1).provide(label, (c) => `n${c.get(count)}`);

expectTypeOf(container.get(count)).toEqualTypeOf<number>();
expectTypeOf(container.get(label)).toEqualTypeOf<string>();

// @ts-expect-error a factory must build the token's type
container.provide(count, () => 'one');

// @ts-expect-error an override must be the token's type
container.override(count, 'one');

// @ts-expect-error a lifecycle hook receives the built value, not another type
container.provide(count, () => 1, { dispose: (value: string) => value.length });
