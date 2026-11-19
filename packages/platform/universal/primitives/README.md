# @kit/primitives

Generic building blocks with no dependency: the time-unit constants (`MS_PER_SECOND`, `MS_PER_MINUTE`,
`MS_PER_HOUR`, `MS_PER_DAY`, `SECONDS_PER_MINUTE`, `SECONDS_PER_HOUR`, `SECONDS_PER_DAY`, `MICROSECONDS_PER_MS`), so
a duration reads as a named unit rather than as arithmetic.

Install: `pnpm add @kit/primitives`. It has no dependency.

Tokens: none.

```ts
import { MS_PER_DAY } from '@kit/primitives';

const retentionMs = 30 * MS_PER_DAY;
```
