# @kit/design-tokens

The engine of a design system: Zod schemas for every token group and theme, `define*` helpers that make a wrong
definition a compile error, colour maths (WCAG contrast, OKLCH, derived accents) and generators that turn
definitions into CSS, a Tailwind theme and a DTCG tokens document. It holds no concrete value; the app brings
its themes and token sets.

Install: `pnpm add @kit/design-tokens zod`. Peer: `zod`.

Tokens: none. Registries: none. The app lists its themes and token sets and hands them to `tokenFiles`.

```ts
import { defineRef, defineTheme, resolveTheme, themeCss } from '@kit/design-tokens';

const { ramps, ref } = defineRef({ sand: { 950: '#14120F', 50: '#FAF6EC' } });
const theme = defineTheme({ /* id, name, color, dataviz, defaults */ });

const resolved = resolveTheme(theme, ramps); // Result<ResolvedTheme, InvalidDefinition>
if (resolved.ok) themeCss(resolved.value);
```

A theme role that names a ramp step that does not exist fails with the field of the role.
