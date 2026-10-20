import { ErrorCodes, type InputFailure } from '@vp/errors';
import { err, ok, type Result } from '@vp/result';
import type { ZodType } from 'zod';
import type { Ref } from './schema/ref';
import { type ResolvedTheme, resolvedThemeSchema, type Theme, ThemeSchema } from './schema/theme';
import { TOKEN_SET_SCHEMAS, type TokenGroup, type TokenSet } from './schema/token-group';

export type InvalidDefinition = InputFailure<typeof ErrorCodes.VALIDATION_FAILED>;

const parseWith = <T>(schema: ZodType<T>, input: unknown): Result<T, InvalidDefinition> => {
  const parsed = schema.safeParse(input);
  if (parsed.success) {
    return ok(parsed.data);
  }
  const [issue] = parsed.error.issues;
  return err({
    code: ErrorCodes.VALIDATION_FAILED,
    message: issue?.message ?? parsed.error.message,
    field: issue?.path.join('.') ?? '',
  });
};

export const parseTheme = (input: unknown): Result<Theme, InvalidDefinition> =>
  parseWith(ThemeSchema, input);

export const parseTokenSet = <G extends TokenGroup>(
  group: G,
  input: unknown
): Result<TokenSet<G>, InvalidDefinition> => parseWith(TOKEN_SET_SCHEMAS[group], input);

export const resolveTheme = (theme: Theme, ramps: Ref): Result<ResolvedTheme, InvalidDefinition> =>
  parseWith(resolvedThemeSchema(ramps), theme);
