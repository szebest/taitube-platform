# @kit/compose-autoscaler

A queue-depth autoscaler for Docker Compose: it polls Prometheus queue metrics and scales worker services with
`docker compose up --scale`. `computeReplicas` is the pure decision, `ComposeAutoscaler` the loop, `run` the CLI.

```sh
pnpm add @kit/compose-autoscaler
```

Tokens and registries: none. The caller passes an `AutoscalerConfig`:
`{ metricsPath, stages }`, where `stages` maps each compose service to its `ScalerStageConfig`.

```ts
import { type AutoscalerConfig, run } from '@kit/compose-autoscaler';

const config: AutoscalerConfig = {
  metricsPath: '/metrics',
  stages: { worker: { minReplicas: 0, maxReplicas: 4, threshold: 1, cooldownSeconds: 300 } },
};

run(config, { argv: process.argv.slice(2), env: process.env, executor, fetcher, onSignal, exit, print, log });
```
