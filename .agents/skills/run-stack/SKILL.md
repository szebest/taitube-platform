---
name: run-stack
description: >-
  Starting, verifying, operating and tearing down the full local stack: infrastructure,
  every app, optional observability, health gates, logs, smoke tests, auth for API calls.
  Use when asked to run everything, start the stack or one app of it, check what is
  running, or debug a service that will not come up.
license: MIT
---

# Run the stack

How to bring a multi-service system up locally and know it works. This repo's targets,
services, ports and recipes: `references/this-repo.md` (read its section for the task, not
the whole file).

## Rules

- **Start only what the task needs**: the infrastructure alone for most work, one app on
  top of it to see a change, the whole stack for an end-to-end check. Never start a stack
  the user did not ask for, and say what you left running.
- **Tiers in dependency order, each gated on health**: datastores first, then one-shot jobs
  (migrations, bucket setup), then the apps, then what depends on them. A tier is done when
  every health check passes and every one-shot has exited 0; a failure names the service
  and shows its last log lines.
- **Address services by name**, never by a generated container name: compose service names
  and labels are stable, container names are not. A command that spans the project (logs,
  status, teardown) includes every profile, or it misses the apps.
- **Prove it with the smoke test**, not with "the containers are up": the smoke exercises
  the real path end to end (for an upload pipeline: upload, process, fetch the result).
- **Read logs per service** while debugging, and the readiness endpoint before the
  liveness one: ready means the dependencies answer.
- **Teardown deletes local data** when the data is disposable; say so before running it on
  someone's machine.
- **Troubleshoot by symptom**: a service that will not start (its log), a dependency not
  ready (the health checks), a port taken (`lsof -i :<port>`), work stuck in progress (the
  worker's log, then its scratch space and memory limits).
