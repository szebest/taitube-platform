export const CORRECTION_MIN_MS = 2_000;
export const CORRECTION_MAX_MS = 30_000;
export const CORRECTION_TEXT_MAX_LENGTH = 200;
export const MAX_CORRECTIONS_PER_VIDEO = 10;

export interface Correction {
  id: string;
  videoId: string;
  startMs: number;
  endMs: number;
  text: string;
  createdAt: Date;
}
