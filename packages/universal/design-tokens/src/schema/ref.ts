import { z } from 'zod';
import { ColorSchema } from './values';

const KebabSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

export const RefSchema = z.record(KebabSchema, z.record(KebabSchema, ColorSchema));

export type Ref = z.output<typeof RefSchema>;
