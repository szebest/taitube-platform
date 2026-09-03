// State machine transitions matching SDD §3.5
export const ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  UPLOADING: ['UPLOADED', 'REJECTED', 'ABANDONED'],
  UPLOADED: ['PROBING'],
  PROBING: ['PROCESSING', 'FAILED'],
  PROCESSING: ['READY', 'FAILED'],
  FAILED: ['PROBING'], // Admin re-process
  READY: ['DELETED'],
  REJECTED: [],
  ABANDONED: [],
  DELETED: [],
} as const;

export function canTransition(from: string, to: string): boolean {
  const allowed = ALLOWED_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}
