import type { Result } from '@kit/result';
import { z } from 'zod';
import { type InvalidEnv, loadEnv, parseEnv } from '../../index';

const schema = z.object({ PORT: z.coerce.number() });
const env = { PORT: '1' };

expectTypeOf(loadEnv(schema, env)).toEqualTypeOf<{ PORT: number }>();
expectTypeOf(parseEnv(schema, env)).toEqualTypeOf<Result<{ PORT: number }, InvalidEnv>>();

// @ts-expect-error the schema is a zod type
loadEnv({ PORT: 1 }, env);

// @ts-expect-error an env value is a string or undefined
loadEnv(schema, { PORT: 1 });
