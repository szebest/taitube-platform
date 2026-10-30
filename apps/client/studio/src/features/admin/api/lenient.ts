import { z } from 'zod';

export function lenient<Schema extends z.ZodType>(schema: Schema) {
  return z
    .custom<z.input<Schema> | undefined>()
    .transform((value) => {
      const parsed = schema.safeParse(value);
      return parsed.success ? parsed.data : undefined;
    })
    .optional();
}
