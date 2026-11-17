import { useT } from '@kit/intl-react';
import { Button, Callout, Icon, Input, useToast } from '@kit/ui';
import { useQueryClient } from '@tanstack/react-query';
import type { Video } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { failureCode, useFailureToast, videoKeys } from '@vp/queries';
import { type KeyboardEvent, useState } from 'react';
import { useUpdateVideo } from '#app/features/creator-stats/hooks/use-update-video';

/** The title edited in place: Enter saves against the version the page holds, Escape cancels, a stale version offers a reload. */
export function EditTitleAction({ video }: { video: Video }) {
  const { tOr } = useT();
  const queryClient = useQueryClient();
  const showToast = useToast();
  const showFailure = useFailureToast();
  const update = useUpdateVideo(video);
  const [draft, setDraft] = useState<string>();
  const conflict =
    update.error !== null && failureCode(update.error) === ErrorCodes.VERSION_CONFLICT;

  const stop = () => {
    update.reset();
    setDraft(undefined);
  };
  const save = (title: string) =>
    update.mutate(
      { title },
      {
        onSuccess: () => {
          showToast({ tone: 'success', title: tOr('creatorStats.titleSaved', {}, '') });
          setDraft(undefined);
        },
        onError: (error) => {
          if (failureCode(error) !== ErrorCodes.VERSION_CONFLICT) {
            showFailure(tOr('creatorStats.saveFailed', {}, ''), error);
          }
        },
      }
    );
  const reload = async () => {
    await queryClient.invalidateQueries({ queryKey: videoKeys.detail(video.id) });
    stop();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') save(event.currentTarget.value);
    if (event.key === 'Escape') stop();
  };

  if (draft === undefined) {
    return (
      <Button variant="soft" size="sm" onClick={() => setDraft(video.title ?? '')}>
        <Icon name="edit" />
        {tOr('creatorStats.editTitle', {}, '')}
      </Button>
    );
  }

  return (
    <div data-slot="creator-stats-edit-title" className="flex w-full flex-col gap-inline">
      <Input
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- the viewer pressed Edit title to type here.
        autoFocus
        aria-label={tOr('creatorStats.titleLabel', {}, '')}
        aria-describedby="creator-stats-title-hint"
        value={draft}
        disabled={update.isPending}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <p id="creator-stats-title-hint" className="m-0 text-label text-fg-muted">
        {tOr('creatorStats.titleHint', {}, '')}
      </p>
      {conflict && (
        <Callout.Root tone="warning" role="alert">
          <Callout.Icon />
          <Callout.Title>{tOr('creatorStats.conflict', {}, '')}</Callout.Title>
          <Callout.Action>
            <Button variant="soft" size="sm" onClick={reload}>
              {tOr('creatorStats.reload', {}, '')}
            </Button>
          </Callout.Action>
        </Callout.Root>
      )}
    </div>
  );
}
