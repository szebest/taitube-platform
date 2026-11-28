import type { JobSchedulerInfo, JobSchedulerTemplate, QueueJob } from '../../job-queue';

expectTypeOf<QueueJob>().toEqualTypeOf<QueueJob<unknown>>();
expectTypeOf<QueueJob<{ videoId: string }>['data']>().toEqualTypeOf<{ videoId: string }>();
expectTypeOf<JobSchedulerInfo<number>['data']>().toEqualTypeOf<number | undefined>();
expectTypeOf<JobSchedulerTemplate<{ id: string }>['data']>().toEqualTypeOf<
  { id: string } | undefined
>();

// @ts-expect-error the data of a job is the payload type it was declared with
const _wrong: QueueJob<{ videoId: string }> = { id: 'a', name: 'n', data: { id: 1 } };
