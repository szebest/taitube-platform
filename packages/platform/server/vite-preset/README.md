# @kit/vite-preset

Vite and Vitest presets for a client app: workspace source aliases, vendor chunking, React plugins with the
compiler, and a bundle guard that fails a build over its size budgets or a forbidden module.

```sh
pnpm add -D @kit/vite-preset vite vitest @tanstack/react-start @tailwindcss/vite @vitejs/plugin-react
```

Tokens and registries: none. Entry points: `clientAppConfig` (`.`), `bundleGuard` (`./bundle-guard`),
`reactPlugins` (`./react-plugins`), `clientAppTestConfig` (`./vitest`).

```ts
import { clientAppConfig } from '@kit/vite-preset';

export default clientAppConfig({ entryBudgetKb: 180 });
```
