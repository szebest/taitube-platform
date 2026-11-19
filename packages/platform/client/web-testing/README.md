# @kit/web-testing

Spec helpers for a React and TanStack app that run without any API client or contract: the jsdom setup file, the
settle setup file, the server-function doubles, `axeViolations`, `createRenderCounter`, `showCues`, `serverRender`
and `trackRouter`. Spec-only: a manifest names it under `devDependencies`.

```ts
// vitest.jsdom.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: [
      '@testing-library/jest-dom/vitest',
      '@kit/web-testing/jsdom.setup',
      '@kit/web-testing/settle.setup',
    ],
    env: { RTL_SKIP_AUTO_CLEANUP: 'true' },
  },
});
```

```ts
import { axeViolations } from '@kit/web-testing/dom';
import { serverRender } from '@kit/web-testing/server';
```
