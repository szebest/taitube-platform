# Changelog

## 0.3.0

- The client build compiles to the `browserslist` of the root above the app, through `browserslist-to-esbuild`, in place of Vite's default `baseline-widely-available`; both are peer dependencies now.
- `ClientAppOptions['plugins']` is called with that esbuild target, so a plugin with a build of its own, such as a service worker's, takes the same one.

## 0.2.0

- Breaking: `clientAppTestConfig` takes the project's whole ordered `setupFiles` and its `env`; no setup file or variable of an app is written into the package.
- Breaking: the bundle guard's `demoPersonas` flag is replaced by `flaggedDirs`, the directories a build may carry only with their environment variable `true`.
- The client build turns off rolldown's `mergeCommonChunks`, so the entry chunk holds what the entry imports and no more: the merge fires whenever it would create no chunk cycle, which let an unrelated import change fold the shared chunks into the entry and break `entryBudgetKb`.

## 0.1.0

- First release: the public API recorded in api/vite-preset.api.txt.
