# @kit/ui

The design system's primitives, tokens, themes and appearance provider for React apps. It holds no product name,
no cookie name and no words: the app brings them.

```sh
pnpm add @kit/ui react react-dom tailwindcss @tanstack/react-router @tanstack/react-start \
  @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities cmdk cookie-es lucide-react radix-ui \
  tailwind-variants zod @fontsource-variable/figtree @fontsource-variable/geist \
  @fontsource-variable/geist-mono @fontsource-variable/newsreader
```

Tokens and seams the app provides:

- `AppearanceStorage` (`cookie`, `legacyCookie`): the cookie names, handed to `requestAppearancePreference` and carried
  by `StoredAppearance` into `AppearanceProvider`.
- `UiCopyProvider` with a `UiCopy` built by `uiCopyFrom`: every word a primitive prints.
- The `name` prop of `Logo`: the product name.
- The app's stylesheet imports `@kit/ui/styles.css` and names the packages it renders with `@source`.

```tsx
import { requestAppearancePreference, ThemedDocument } from '@kit/ui';

const stored = requestAppearancePreference({ cookie: 'app.appearance', legacyCookie: 'app.theme' });

<ThemedDocument stored={stored} lang="en" dir="ltr">...</ThemedDocument>;
```

Themes and token sets are registered through `@kit/ui/appearance/registry` and `@kit/ui/appearance/register-theme`.
