export const VideoStatuses = [
  'UPLOADING',
  'UPLOADED',
  'PROBING',
  'PROCESSING',
  'READY',
  'FAILED',
  'REJECTED',
  'ABANDONED',
  'DELETED',
] as const;
export type VideoStatus = (typeof VideoStatuses)[number];

export const StepStatuses = ['PENDING', 'RUNNING', 'DONE', 'FAILED'] as const;
export type StepStatus = (typeof StepStatuses)[number];
