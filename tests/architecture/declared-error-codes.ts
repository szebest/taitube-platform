import { read } from './repo-files';

/** The app's own codes, and the codes each platform package emits, which the app's set spreads in. */
const VOCABULARY_FILES = [
  'packages/universal/errors/src/api-error-codes.ts',
  'packages/universal/errors/src/pipeline-error-codes.ts',
  'packages/platform/universal/errors/src/common-codes.ts',
  'packages/platform/universal/errors/src/infra-codes.ts',
  'packages/platform/universal/pagination/src/cursor-codec.ts',
  'packages/platform/universal/intl/src/failures.ts',
];

const CODE_KEY = /^\s{2}([A-Z][A-Z0-9_]+):\s*'/gm;

/**
 * Every code declared as an `as const` member, read as text: `tests/` is not a workspace package,
 * so the suite reads sources rather than importing them.
 */
export function declaredErrorCodes(): string[] {
  return VOCABULARY_FILES.flatMap((file) =>
    [...read(file).matchAll(CODE_KEY)].map((match) => match[1] as string)
  );
}
