# AGENTS.md — @vp/logger (the one logger)

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

---

## 1. Scope

Every log line in this repo is written through `createLogger` here: the two deployables, the CLIs, the
migrate and seed runners, `scripts/` and the e2e runner. No other package imports `pino`, and nothing
calls `console` (`zero-matches.test.ts`).

- `format: 'json'` is for a deployable: one JSON object per line on stdout, credential headers redacted,
  the active trace and span ids and the `LogContext` bindings (the request id a job carries) on every line.
- `format: 'pretty'` is for a person at a terminal: `level message key=value` on stderr, then the error
  and its cause chain. A CLI's own output, such as a minted token, is written to stdout, not logged.

## 2. Rules

- The caller passes `format` and `level`, from config or a CLI flag. The package reads no environment.
- Log an error as a field, `log.error({ err }, 'could not mint token')`. `serializeError` is the one
  place an error becomes text: message, `@vp/errors` code, stack and causes. Never format one by hand.
- A message is a fixed lowercase string, and what varies goes in the fields:
  `log.info({ videoId }, 'probe queued')`, never a template string (`log-calls.test.ts`).

## 3. Local Commands

```bash
pnpm --filter @vp/logger test
bun test packages/server/logger
```
