# @kit/errors

Returned failures, an app's error code set and the retry class of each code. A failure is a value with a `code`
and a `message`; an input failure also names the `field` it rejected, which is what makes it safe to send back.

Install: `pnpm add @kit/errors`. It depends on `@kit/di`.

Tokens: `ErrorCodeRegistry`, the app's `defineErrorCodes` value, with no default.

```ts
import { CommonErrorCodes, classifyError, defineErrorCodes, type InputFailure } from '@kit/errors';

export const codes = defineErrorCodes({
  codes: { ...CommonErrorCodes, NOT_FOUND: 'NOT_FOUND' },
  retryClass: { VALIDATION_FAILED: 'permanent', INTERNAL: 'transient', NOT_FOUND: 'permanent' },
  internal: CommonErrorCodes.INTERNAL,
});

type BadTitle = InputFailure<typeof CommonErrorCodes.VALIDATION_FAILED>;

classifyError(codes, { code: 'NOT_FOUND', message: 'gone' }); // 'permanent'
```

A platform package that emits a code of its own exports it as an `as const` object, and the app spreads that
object into its set, so each code is written once.
