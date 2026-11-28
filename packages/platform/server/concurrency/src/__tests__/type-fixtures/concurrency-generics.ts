import { CircuitBreaker, Singleflight } from '../../index';

const flight = new Singleflight();

expectTypeOf(flight.do('k', () => Promise.resolve(1))).toEqualTypeOf<Promise<number>>();
expectTypeOf(flight.do('k', async () => 'x')).toEqualTypeOf<Promise<string>>();

// @ts-expect-error the work returns a promise
expectTypeOf(flight.do('k', () => 1)).toBeObject();

// @ts-expect-error the key is a string
expectTypeOf(flight.do(1, () => Promise.resolve(1))).toBeObject();

const breaker = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 100, now: () => 0 });

expectTypeOf(breaker.state()).toEqualTypeOf<'closed' | 'open' | 'half-open'>();

// @ts-expect-error every option is required
new CircuitBreaker({ failureThreshold: 3 });
