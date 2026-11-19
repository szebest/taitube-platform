# Changelog

## 0.2.0

- Breaking: `clientAppTestConfig` takes the project's whole ordered `setupFiles` and its `env`; no setup file or variable of an app is written into the package.
- Breaking: the bundle guard's `demoPersonas` flag is replaced by `flaggedDirs`, the directories a build may carry only with their environment variable `true`.

## 0.1.0

- First release: the public API recorded in api/vite-preset.api.txt.
