import { z } from 'zod';
import { loadEnvOrExit } from '../../load-env-or-exit';

const schema = z.object({ PORT: z.coerce.number() });
const host = { env: { PORT: '1' }, exit: (_code: number) => undefined };

expectTypeOf(loadEnvOrExit(schema, 'info', 'api', host)).toEqualTypeOf<
  { PORT: number } | undefined
>();

// @ts-expect-error the schema is a zod type
loadEnvOrExit({ PORT: 1 }, 'info', 'api', host);

// @ts-expect-error the host carries the env and an exit
loadEnvOrExit(schema, 'info', 'api', { env: {} });
