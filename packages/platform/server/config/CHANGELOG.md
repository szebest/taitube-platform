# Changelog

## 0.3.0

- `loadEnv(schema, env)` takes `env` as a required parameter; it no longer falls back to `process.env`.

## 0.2.0

- `loadEnv(schema, env)`, `parseEnv(schema, env)` and `loadEnvOrExit(schema, defaultLogLevel, ...)` take the env schema from the caller; the package no longer knows the app's keys.
- `describeEnvKey` and `EnvKeyShape`, moved here from the app's env schema package, describe the key schema they are handed.

## 0.1.0

- First release: the public API recorded in api/config.api.txt.
