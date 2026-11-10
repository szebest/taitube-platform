import { useQuery } from '@tanstack/react-query';
import type { SavedReplyView } from '@vp/api-contracts';
import { SAVED_REPLY_LIMITS } from '@vp/domain';
import { useT } from '@vp/intl-react';
import {
  savedRepliesQueryOptions,
  useApi,
  useChangeSavedReply,
  useFailureToast,
} from '@vp/queries';
import { Button, Field, Icon, IconButton, Input, Textarea } from '@vp/ui';
import { useState } from 'react';
import { SettingsListSection } from '../settings-section/settings-section';

interface Draft {
  id: string | null;
  title: string;
  body: string;
}

const EMPTY: Draft = { id: null, title: '', body: '' };

/** The channel's canned replies: listed, added, edited in place and deleted, each change its own request. */
export function SavedRepliesSection() {
  const { tOr } = useT();
  const showFailure = useFailureToast();
  const change = useChangeSavedReply();
  const replies = useQuery(savedRepliesQueryOptions(useApi()));
  const [draft, setDraft] = useState<Draft | null>(null);

  const rows = replies.data ?? [];
  const full = rows.length >= SAVED_REPLY_LIMITS.perChannel;

  const submit = () => {
    if (draft === null) return;
    const reply = { title: draft.title.trim(), body: draft.body.trim() };
    change.mutate(
      draft.id === null ? { type: 'create', reply } : { type: 'update', id: draft.id, edit: reply },
      {
        onSuccess: () => setDraft(null),
        onError: (error) => showFailure(tOr('studio.settingsReplyFailed', {}, ''), error),
      }
    );
  };

  const edit = ({ id, title, body }: SavedReplyView) => setDraft({ id, title, body });

  return (
    <SettingsListSection
      title={tOr('studio.settingsRepliesTitle', {}, '')}
      description={tOr('studio.settingsRepliesDescription', {}, '')}
    >
      {replies.isError && (
        <p role="alert" className="m-0 text-body-sm text-fg-muted">
          {tOr('studio.settingsRepliesFailed', {}, '')}
        </p>
      )}
      {replies.isSuccess && rows.length === 0 && draft === null && (
        <p className="m-0 text-body-sm text-fg-muted">
          {tOr('studio.settingsRepliesEmpty', {}, '')}
        </p>
      )}
      <ul className="m-0 flex list-none flex-col gap-stack p-0">
        {rows.map((reply) => (
          <li key={reply.id} className="flex items-start justify-between gap-inline">
            <span className="flex min-w-0 flex-col">
              <span className="text-label">{reply.title}</span>
              <span className="line-clamp-2 text-body-sm text-fg-muted">{reply.body}</span>
            </span>
            <span className="flex items-center gap-inline">
              <IconButton
                size="sm"
                aria-label={tOr('studio.settingsReplyEdit', { title: reply.title }, '')}
                onClick={() => edit(reply)}
              >
                <Icon name="edit" />
              </IconButton>
              <IconButton
                size="sm"
                aria-label={tOr('studio.settingsReplyDelete', { title: reply.title }, '')}
                onClick={() =>
                  change.mutate(
                    { type: 'delete', id: reply.id },
                    {
                      onError: (error) =>
                        showFailure(tOr('studio.settingsReplyFailed', {}, ''), error),
                    }
                  )
                }
              >
                <Icon name="trash" />
              </IconButton>
            </span>
          </li>
        ))}
      </ul>
      {draft === null ? (
        <>
          {full && (
            <p className="m-0 text-caption text-fg-muted">
              {tOr('studio.settingsReplyLimit', {}, '')}
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            disabled={full}
            onClick={() => setDraft(EMPTY)}
          >
            {tOr('studio.settingsReplyAdd', {}, '')}
          </Button>
        </>
      ) : (
        <form
          className="flex flex-col gap-stack"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Field.Root>
            <Field.Label>{tOr('studio.settingsReplyTitleLabel', {}, '')}</Field.Label>
            <Input
              maxLength={SAVED_REPLY_LIMITS.titleLength}
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          </Field.Root>
          <Field.Root>
            <Field.Label>{tOr('studio.settingsReplyBodyLabel', {}, '')}</Field.Label>
            <Textarea
              maxLength={SAVED_REPLY_LIMITS.bodyLength}
              value={draft.body}
              onChange={(event) => setDraft({ ...draft, body: event.target.value })}
            />
          </Field.Root>
          <span className="flex justify-end gap-inline">
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
              {tOr('studio.deleteCancel', {}, '')}
            </Button>
            <Button
              type="submit"
              variant="solid"
              tone="accent"
              size="sm"
              loading={change.isPending}
              disabled={draft.title.trim() === '' || draft.body.trim() === ''}
            >
              {tOr('studio.settingsReplySave', {}, '')}
            </Button>
          </span>
        </form>
      )}
    </SettingsListSection>
  );
}
