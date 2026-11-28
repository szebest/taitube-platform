# @kit/vite-preset

Vite and Vitest presets for a client app: workspace source aliases, vendor chunking, React plugins with the
compiler, and a bundle guard that fails a build over its size budgets or a forbidden module.

```sh
pnpm add -D @kit/vite-preset vite vitest @tanstack/react-start @tailwindcss/vite @vitejs/plugin-react
```

Tokens and registries: none. Entry points: `clientAppConfig` (`.`), `bundleGuard` (`./bundle-guard`),
`reactPlugins` (`./react-plugins`), `clientAppTestConfig` (`./vitest`). `packagesDir` is the directory whose
`universal/`, `client/` and `platform/` tiers resolve from source; one without them aliases nothing. The `'babel'`
compiler needs `@rolldown/plugin-babel`, `@babel/core` and `babel-plugin-react-compiler` installed (optional peers).

```ts
import { fileURLToPath } from 'node:url';
import { clientAppConfig } from '@kit/vite-preset';

export default clientAppConfig({
  configUrl: import.meta.url,
  port: 5173,
  packagesDir: fileURLToPath(new URL('../../packages', import.meta.url)),
  entryBudgetKb: 180,
});
```

The package ships TypeScript source, which Node does not load from `node_modules`: an app outside this workspace
loads its Vite or Vitest config with `--configLoader runner` (`vitest run --configLoader runner`).
