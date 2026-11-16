import { z } from 'zod';
import { notificationOutbox } from './notifications';

/** Rides the `notify` queue: an export is short and bounded, and needs no media tools or pod of its own. */
export const EXPORT_DATA = 'export';

export const ExportJob = z.object({
  exportId: z.uuid(),
  traceparent: z.string().optional(),
  requestId: z.string().optional(),
});
export type ExportJob = z.infer<typeof ExportJob>;

/** The outbox row that queues an export once its request commits; one job per export, however often. */
export const exportOutbox = (job: ExportJob) =>
  notificationOutbox({ name: EXPORT_DATA, data: job, jobId: `${job.exportId}--${EXPORT_DATA}` });
