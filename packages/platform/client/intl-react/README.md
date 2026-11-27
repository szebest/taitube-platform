# @kit/intl-react

React bindings for formatting and translation: `IntlProvider`, `useFormat` and `useT`, reading the locale the app
negotiated.

```sh
pnpm add @kit/intl-react react
```

It consumes no token of its own. The app mounts `IntlProvider` at its root with the negotiated locale and a clock,
and binds its translator once with `createReactI18n`, over the `I18n` it built with `@kit/i18n`:

```tsx
import { createReactI18n, IntlProvider } from '@kit/intl-react';

export const { TranslatorProvider, useT } = createReactI18n(createI18n<AppCatalogue>());

<IntlProvider locale={locale} clock={clock}>
  <TranslatorProvider catalogues={{ locale: 'en', source, translations }}>{children}</TranslatorProvider>
</IntlProvider>;
```

`useT()` is typed by `AppCatalogue`: a wrong key or wrong arguments fail to compile.
