import type { Result } from '@kit/result';
import type { EndScreen } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

export type EndScreenDraft = Omit<EndScreen, 'version'>;

export interface VideoEndScreenRepositoryPort {
  find(videoId: string): Promise<Result<EndScreen | null, DatabaseUnavailable>>;
  /**
   * Replaces the end screen when `expectedVersion` is the stored one (0 for a video with none) and
   * returns the saved row; `null` when another save got there first.
   */
  replace(
    draft: EndScreenDraft,
    expectedVersion: number
  ): Promise<Result<EndScreen | null, DatabaseUnavailable>>;
}
