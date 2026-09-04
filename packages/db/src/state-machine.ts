// State machine transitions matching SDD §3.5
export const ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  UPLOADING: ['UPLOADED', 'REJECTED', 'ABANDONED'],
  UPLOADED: ['PROBING'],
  PROBING: ['PROCESSING', 'FAILED'],
  PROCESSING: ['READY', 'FAILED', 'PROBING'],
  FAILED: ['PROBING'], // Re-process
  READY: ['DELETED', 'PROBING'], // Soft delete or re-process
  REJECTED: [],
  ABANDONED: [],
  DELETED: [],
} as const;

export function canTransition(from: string, to: string): boolean {
  const allowed = ALLOWED_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}
