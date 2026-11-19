# @kit/validation

The shared plumbing of input rules: field failures bound to one code, and plain text normalised and measured in
code points. A rule built on it is a pure function of its input that returns a `Result`.

Install: `pnpm add @kit/validation`. It depends on `@kit/errors`.

Tokens: none. The code a field failure carries is the argument of `defineFieldFailures`.

```ts
import { CommonErrorCodes } from '@kit/errors';
import { err, ok } from '@kit/result';
import { defineFieldFailures, normalizePlainText, withinLength } from '@kit/validation';

const { invalidLength } = defineFieldFailures(CommonErrorCodes.VALIDATION_FAILED);
const TITLE = { minLength: 1, maxLength: 100 };

export const validateTitle = (input: string) => {
  const title = normalizePlainText(input);
  return withinLength(title, TITLE) ? ok(title) : err(invalidLength('title', TITLE));
};
```
