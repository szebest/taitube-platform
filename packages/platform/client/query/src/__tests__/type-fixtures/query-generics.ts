import type { QueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  type EnsureFound,
  type RetryPolicy,
  createEnsureFound,
  createRetryPolicy,
  parseParam,
} from '../../index';

expectTypeOf(parseParam(z.string(), 'abc')).toEqualTypeOf<string>();
expectTypeOf(parseParam(z.coerce.number(), '7')).toEqualTypeOf<number>();
expectTypeOf(parseParam(z.enum(['a', 'b']), 'a')).toEqualTypeOf<'a' | 'b'>();

// @ts-expect-error the schema is a zod type, not a plain function
parseParam((raw: string) => raw, 'abc');

// @ts-expect-error the raw segment is a string
parseParam(z.string(), 1);

const ensureFound = createEnsureFound(() => false);
declare const queryClient: QueryClient;

expectTypeOf(ensureFound).toEqualTypeOf<EnsureFound>();
expectTypeOf(
  ensureFound(queryClient, { queryKey: ['count'], queryFn: () => Promise.resolve(1) })
).toEqualTypeOf<Promise<number>>();
expectTypeOf(
  ensureFound(queryClient, { queryKey: ['name'], queryFn: () => Promise.resolve('x') })
).toEqualTypeOf<Promise<string>>();

// @ts-expect-error the missing-resource test is a function
createEnsureFound('NOT_FOUND');

// @ts-expect-error a query key is an array
ensureFound(queryClient, { queryKey: 'count', queryFn: () => Promise.resolve(1) });

const policy = createRetryPolicy({ classify: () => 'transient' });

expectTypeOf(policy).toEqualTypeOf<RetryPolicy>();
expectTypeOf(policy.shouldRetry).parameters.toEqualTypeOf<[number, unknown]>();

createRetryPolicy({ classify: () => 'permanent', retryAfterMs: () => undefined });

// @ts-expect-error a failure is transient or permanent, nothing else
createRetryPolicy({ classify: () => 'sometimes' });

// @ts-expect-error classify is required
createRetryPolicy({});
