# @kit/appearance

The vocabulary a viewer's appearance is spoken in, with no dependency: the colour modes (`MODE_OPTIONS`,
`ModeOption`, `DEFAULT_MODE`), the contrast levels (`CONTRAST_OPTIONS`, `ContrastOption`, `DEFAULT_CONTRAST`),
the shapes of a theme or token-set id, a token group name and an accent (`PREFERENCE_ID_PATTERN`,
`TOKEN_GROUP_PATTERN`, `ACCENT_PATTERN`) and the cap on token-set overrides (`MAX_APPEARANCE_OVERRIDES`). The
theme engine, the UI kit and the app's stored preferences all build on these, so none redefines them.

Install: `pnpm add @kit/appearance`. It has no dependency.

Tokens: none.

```ts
import { ACCENT_PATTERN, MODE_OPTIONS } from '@kit/appearance';

const modes = MODE_OPTIONS.filter((mode) => mode !== 'system');
const valid = ACCENT_PATTERN.test('#3366ff');
```
