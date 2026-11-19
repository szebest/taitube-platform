# @kit/intl

Formatting on the platform's own `Intl`: a formatter takes a tagged value and a `FormatContext` and returns
`Result<string, FormatFailure>`. Numbers, dates, times, ranges, relative time, durations, lists, money, bytes,
bitrates, plurals, collation and display names; `Intl` objects come from an `IntlCache` the owner creates.

Install: `pnpm add @kit/intl`. It depends on `@kit/result`.

Tokens: none. The locale, time zone, reference instant and cache arrive in the `FormatContext`; `localeChain`
walks a tag down to the fallback locale.

```ts
import { createIntl, createIntlCache, number } from '@kit/intl';

const intl = createIntl({ locale: 'sv', timeZone: 'UTC', now: '2026-09-22T18:30:00.000Z', cache: createIntlCache() });
intl.format(number(1234.5)); // Result<string, FormatFailure>
```

A value specific to one product is a function returning a tagged value (`{ type: 'count', value }`), written in
the app; the formatters are not edited for it.
