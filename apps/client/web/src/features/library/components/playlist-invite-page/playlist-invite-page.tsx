import { EmptyState } from '@kit/components';
import { Button } from '@kit/ui';
import { Link } from '@tanstack/react-router';
import { ErrorCodes } from '@vp/errors';
import { failureCode, present } from '@vp/queries';
import { useAnswerPlaylistInvite } from '#app/features/library/hooks/use-answer-playlist-invite';
import { useT } from '#app/lib/messages';

export interface PlaylistInvitePageProps {
  token: string;
  /** A personal invite, opened from its notification, which can also be declined. */
  personal: boolean;
}

/** `/playlist-invite/$token`: join the playlist an invite names, or turn a personal one down. */
export function PlaylistInvitePage({ token, personal }: PlaylistInvitePageProps) {
  const { tOr } = useT();
  const answer = useAnswerPlaylistInvite(token);

  const code = answer.isError ? failureCode(answer.error) : null;

  if (code === ErrorCodes.PLAYLIST_INVITE_INVALID) {
    return (
      <EmptyState.Root size="page">
        <EmptyState.Title asChild>
          <h1>{tOr('playlistPeople.inviteGoneTitle', {}, '')}</h1>
        </EmptyState.Title>
        <EmptyState.Description>
          {tOr('playlistPeople.inviteGoneBody', {}, '')}
        </EmptyState.Description>
        <EmptyState.Action asChild variant="solid" tone="accent">
          <Link to="/">{tOr('playlistPeople.goHome', {}, '')}</Link>
        </EmptyState.Action>
      </EmptyState.Root>
    );
  }

  return (
    <section
      className="mx-auto flex max-w-[36rem] flex-col gap-stack py-section"
      aria-labelledby="playlist-invite-title"
    >
      <h1 id="playlist-invite-title" className="m-0 text-headline">
        {tOr('playlistPeople.inviteTitle', {}, '')}
      </h1>
      <p className="m-0 text-body">{tOr('playlistPeople.inviteBody', {}, '')}</p>
      {code !== null && (
        <p role="alert" className="m-0 text-caption text-danger-ink">
          {tOr(present({ code }).copy, {}, '')}
        </p>
      )}
      <div className="flex flex-wrap gap-inline">
        <Button
          variant="solid"
          tone="accent"
          loading={answer.isPending && answer.variables === 'accept'}
          disabled={answer.isPending}
          onClick={() => answer.mutate('accept')}
        >
          {tOr('playlistPeople.accept', {}, '')}
        </Button>
        {personal && (
          <Button
            variant="ghost"
            loading={answer.isPending && answer.variables === 'decline'}
            disabled={answer.isPending}
            onClick={() => answer.mutate('decline')}
          >
            {tOr('playlistPeople.decline', {}, '')}
          </Button>
        )}
      </div>
    </section>
  );
}
