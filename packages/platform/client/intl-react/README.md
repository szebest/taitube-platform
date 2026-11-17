# @kit/intl-react

React bindings for formatting and translation: `IntlProvider`, `useFormat` and `useT`, reading the locale the app
negotiated.

```sh
pnpm add @kit/intl-react react
```

It consumes no token of its own. The app mounts `IntlProvider` at its root with the locale and the translation
catalogues it loaded.

```tsx
import { IntlProvider } from '@kit/intl-react';

<IntlProvider locale={locale} catalogues={catalogues}>{children}</IntlProvider>;
```
