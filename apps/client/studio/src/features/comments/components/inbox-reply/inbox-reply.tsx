import { useT } from '@vp/intl-react';
import { useFailureToast } from '@vp/queries';
import { Button, Textarea, useToast, useUiCopy } from '@vp/ui';
import { useState } from 'react';
import type { InboxComment } from '#app/features/comments/api/inbox-queries';
import { useReplyToComment } from '#app/features/comments/hooks/use-reply-to-comment';
import { SavedRepliesPicker } from '../saved-replies-picker/saved-replies-picker';

export interface InboxReplyProps {
  comment: InboxComment;
  onDone: () => void;
}

/** The creator's reply, written in the inbox row and posted in the comment's thread. */
export function InboxReply({ comment, onDone }: InboxReplyProps) {
  const [draft, setDraft] = useState('');
  const showToast = useToast();
  const showFailure = useFailureToast();
  const { tOr } = useT();
  const { cancel } = useUiCopy();
  const reply = useReplyToComment(comment);

  const content = draft.trim();

  const send = () =>
    reply.mutate(content, {
      onSuccess: () => {
        showToast({ tone: 'success', title: tOr('studio.commentsReplied', {}, '') });
        onDone();
      },
      onError: (error) => showFailure(tOr('studio.commentsReplyFailed', {}, ''), error, send),
    });

  return (
    <form
      className="mt-inline flex flex-col gap-inline"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <Textarea
        aria-label={tOr('studio.commentsReplyLabel', {}, '')}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <span className="flex justify-end gap-inline">
        <SavedRepliesPicker
          onPick={(body) => setDraft(draft.trim() === '' ? body : `${draft.trimEnd()} ${body}`)}
        />
        <Button variant="ghost" size="sm" onClick={onDone}>
          {cancel}
        </Button>
        <Button
          type="submit"
          variant="solid"
          tone="accent"
          size="sm"
          loading={reply.isPending}
          disabled={content === ''}
        >
          {tOr('studio.commentsSendReply', {}, '')}
        </Button>
      </span>
    </form>
  );
}
