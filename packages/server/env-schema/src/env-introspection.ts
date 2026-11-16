import { z } from 'zod';
import { AppEnvSchema } from './app-env';
import type { AppEnvKey } from './env-doc';

type EnvDefault =
  | { kind: 'required' }
  | { kind: 'unset' }
  | { kind: 'value'; value: string; parsed: unknown };

/** @internal Exported for its spec. */
export interface EnvKeyShape {
  type: string;
  default: EnvDefault;
}

const UNBOUNDED = Number.MAX_SAFE_INTEGER;

function bounds(schema: z.core.JSONSchema.BaseSchema): string[] {
  const limits: [string, number | boolean | undefined][] = [
    ['>=', schema.minimum],
    ['>', schema.exclusiveMinimum],
    ['<=', schema.maximum],
    ['<', schema.exclusiveMaximum],
  ];
  return limits.flatMap(([operator, limit]) =>
    typeof limit === 'number' && limit < UNBOUNDED ? [`${operator} ${limit}`] : []
  );
}

function typeOf(schema: z.core.JSONSchema.BaseSchema, parsedDefault: unknown): string {
  if (Array.isArray(parsedDefault)) return 'comma list';
  if (schema.enum) return schema.enum.join(' | ');
  if (schema.type === 'integer' || schema.type === 'number') {
    return [schema.type, ...bounds(schema)].join(' ');
  }
  if (schema.format === 'uri') return 'url';
  if (schema.format === 'uuid') return 'uuid';
  return 'string';
}

function textOf(value: unknown): string {
  return Array.isArray(value) ? value.join(',') : String(value);
}

/** @internal The input type and the default of one key, read from the schema itself rather than retyped. */
export function describeEnvKey(key: AppEnvKey): EnvKeyShape {
  const schema = AppEnvSchema.shape[key];
  const outcome = schema.safeParse(undefined);
  const parsed = outcome.success ? outcome.data : undefined;
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });

  const defaultOf = (): EnvDefault => {
    if (!outcome.success) return { kind: 'required' };
    if (parsed === undefined) return { kind: 'unset' };
    return { kind: 'value', value: textOf(parsed), parsed };
  };

  return { type: typeOf(json, parsed), default: defaultOf() };
}
