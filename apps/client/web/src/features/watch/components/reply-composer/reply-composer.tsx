import { useUiCopy } from '@kit/ui';
import { ActingAsLine, useIdentityGuard } from '@vp/queries';
import { CommentThread } from '#app/components/watch/comment-thread';

export interface ReplyComposerProps {
  draft: string;
  onChange: (draft: string) => void;
  onSend: () => void;
  sending: boolean;
}

export function ReplyComposer({ draft, onChange, onSend, sending }: ReplyComposerProps) {
  const { reply } = useUiCopy();
  const guard = useIdentityGuard();

  return (
    <div className="col-start-2 flex flex-col gap-inline">
      <ActingAsLine action="reply" guard={guard} />
      <CommentThread.Composer
        value={draft}
        onChange={onChange}
        onSubmit={() => guard.guard(onSend)}
        submitting={sending}
        aria-label={reply}
      />
    </div>
  );
}
