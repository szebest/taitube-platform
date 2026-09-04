export interface InternalStep {
  id: string;
  videoId: string;
  step: string;
  rendition: string;
  jobId: string;
  attempt: number;
  status: 'QUEUED' | 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'DEAD';
  workerId: string | null;
  lockToken: string | null;
  startedAt: Date | null;
  heartbeatAt: Date | null;
  finishedAt: Date | null;
  completedAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  result: unknown;
  createdAt: Date;
}
