import { ErrorCodes, type Failure } from '@vp/errors';

export type DlqEntryNotFound = Failure<
  typeof ErrorCodes.DLQ_ENTRY_NOT_FOUND,
  { dlqEntryId: string }
>;

/** The entry names a queue this deployment does not run, which is a wiring fault, not a request one. */
export type ReplayQueueUnknown = Failure<typeof ErrorCodes.INTERNAL, { queue: string }>;

export function dlqEntryNotFound(dlqEntryId: string): DlqEntryNotFound {
  return {
    code: ErrorCodes.DLQ_ENTRY_NOT_FOUND,
    message: `DLQ entry "${dlqEntryId}" not found`,
    dlqEntryId,
  };
}

export function replayQueueUnknown(queue: string): ReplayQueueUnknown {
  return {
    code: ErrorCodes.INTERNAL,
    message: `Target queue "${queue}" is not available for replay`,
    queue,
  };
}
