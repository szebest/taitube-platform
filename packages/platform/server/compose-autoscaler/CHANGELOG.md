# Changelog

## 0.2.0

- `AutoscalerOptions` and `CliHost` take a required `now: () => number`, and `tick(nowMs)` a required time: the runner no longer reads `Date.now()` itself.

## 0.1.0

- First release: the public API recorded in api/compose-autoscaler.api.txt.
