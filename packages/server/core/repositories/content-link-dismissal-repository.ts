import type { Result } from '@kit/result';
import type { DatabaseUnavailable } from '@vp/errors';

export interface ContentLinkDismissalRepositoryPort {
  dismiss(
    channelId: string,
    suggestionKey: string,
    dismissedBy: string
  ): Promise<Result<void, DatabaseUnavailable>>;
  dismissedKeys(channelId: string): Promise<Result<Set<string>, DatabaseUnavailable>>;
}
