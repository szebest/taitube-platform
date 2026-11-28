# @kit/intl

Formatting on the platform's own `Intl`: a formatter takes a tagged value and a `FormatContext` and returns
`Result<string, FormatFailure>`. Numbers, dates, times, ranges, relative time, durations, lists, money, bytes,
bitrates, plurals, collation and display names; `Intl` objects come from an `IntlCache` the owner creates.

Install: `pnpm add @kit/intl`. It depends on `@kit/result` and `@kit/di`.

Tokens: `FormatPresets`, the app's `definePresets` table, required and with no default; the message engine and a
server render read it. The locale, time zone, reference instant and cache arrive in the `FormatContext`; `localeChain`
walks a tag down to its language, and the caller appends its own source locale. The package holds no locale list:
the app registers its own.

```ts
import { defineLocales } from '@kit/intl';

export const LOCALES = defineLocales({
  source: 'fi',
  details: { fi: { name: 'Suomi', direction: 'ltr' }, ar: { name: 'العربية', direction: 'rtl' } },
});
LOCALES.tags; // ['fi', 'ar']
LOCALES.isSupported('ar'); // true, and narrows the tag
```

```ts
import { createIntl, createIntlCache, number } from '@kit/intl';

const intl = createIntl({ locale: 'sv', timeZone: 'UTC', now: '2026-09-22T18:30:00.000Z', cache: createIntlCache() });
intl.format(number(1234.5)); // Result<string, FormatFailure>
```

A value specific to one product is a function returning a tagged value (`{ type: 'count', value }`), written in
the app; the formatters are not edited for it.
