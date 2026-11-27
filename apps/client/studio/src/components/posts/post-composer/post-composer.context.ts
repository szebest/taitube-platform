import { createCompoundContext } from '@kit/ui';
import type { DraftUpdate, PostComposerMode, PostDraft } from './types';

export const [PostComposerContext, usePostComposer] = createCompoundContext<{
  draft: PostDraft;
  mode: PostComposerMode;
  pollLocked: boolean;
  problem: string | undefined;
  change: (patch: Partial<PostDraft>) => void;
  update: (update: DraftUpdate) => void;
}>('PostComposer');
