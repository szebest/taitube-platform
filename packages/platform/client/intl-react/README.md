# @kit/intl-react

React bindings for formatting and translation: `IntlProvider`, `useFormat` and `useT`, reading the locale the app
negotiated.

```sh
pnpm add @kit/intl-react react
```

It consumes no token of its own. The app mounts `IntlProvider` at its root with the negotiated locale, a clock and a
`createTranslator` that builds its translator over the locale's formatting binding.

```tsx
import { IntlProvider } from '@kit/intl-react';

<IntlProvider locale={locale} clock={clock} createTranslator={(intl) => createAppTranslator(intl, catalogues)}>
  {children}
</IntlProvider>;
```

The translator's type is the app's, declared once by merging into `IntlRegister`, which is what types `useT`.

```ts
declare module '@kit/intl-react' {
  interface IntlRegister {
    translator: AppTranslator;
  }
}
```
