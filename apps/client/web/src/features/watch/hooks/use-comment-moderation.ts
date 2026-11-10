import type { CommentView } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import {
  useFailureToast,
  useLiftRestriction,
  useModerateComment,
  usePinComment,
} from '@vp/queries';
import { useToast } from '@vp/ui';
import type { ModerationChoice } from '#app/features/watch/hooks/use-moderation-choices';

type Direct = Extract<ModerationChoice, 'approve' | 'unhide' | 'lift'>;

/** The comment actions that need nothing more than a click: pin, approve, unhide and lift. */
export function useCommentModeration(comment: CommentView, channelId: string | undefined) {
  const { tOr } = useT();
  const showToast = useToast();
  const showFailure = useFailureToast();
  const pin = usePinComment();
  const moderate = useModerateComment();
  const lift = useLiftRestriction();

  const done = (action: Direct) =>
    showToast({ tone: 'success', title: tOr('watch.moderationDone', { action }, '') });
  const failed = (error: unknown) => showFailure(tOr('watch.moderationFailed', {}, ''), error);

  return {
    togglePin: () =>
      pin.mutate(
        { commentId: comment.id, pinned: !comment.isPinned },
        { onError: (error) => showFailure(tOr('watch.pinFailed', {}, ''), error) }
      ),
    run: (action: Direct) => {
      if (action === 'lift') {
        if (channelId) {
          lift.mutate(
            { channelId, userId: comment.author.userId },
            { onSuccess: () => done(action), onError: failed }
          );
        }
        return;
      }
      moderate.mutate(
        { commentId: comment.id, action: { action } },
        { onSuccess: () => done(action), onError: failed }
      );
    },
  };
}
