# @kit/ports

The ports an app's adapters implement for its infrastructure: a cache, a database client, a job queue and a flow
producer, each returning the `*Unavailable` failures of `@kit/errors` as a `Result`, and the `HealthCheckable`
probe they share.

```sh
pnpm add @kit/ports
```

Tokens and registries: none. Entry points: `CacheClient`, `DatabaseClient`, `JobQueue`, `FlowProducerPort`,
`HealthCheckable`, the job and flow shapes (`QueueJob`, `QueueJobOptions`, `QueueJobCounts`, `FlowJobNode`) and
`QUEUE_JOB_STATES`.

`@kit/ports/contract` exports `describeCacheClientContract`, `describeJobQueueContract` and
`describeFlowProducerContract`. Each takes a function that makes the subject, and registers the suite with the
vitest globals; vitest is a peer dependency.

```ts
import { describeCacheClientContract } from '@kit/ports/contract';

describeCacheClientContract(async () => {
  const cache = new MyCacheClient();
  return { cache, close: async () => void (await cache.close()) };
});
```
