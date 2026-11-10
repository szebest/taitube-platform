import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useFormat, useT } from '@vp/intl-react';
import { isChannelTeamMember } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { ownRestrictionQueryOptions, useAccount, useApi, videoQueryOptions } from '@vp/queries';
import { unwrapOr } from '@vp/result';
import { Button, Callout } from '@vp/ui';
import { CommentThread } from '#app/components/watch/comment-thread';
import { useCountdown } from '#app/features/watch/hooks/use-countdown';
import { useSetSubscription } from '#app/hooks/use-set-subscription';
import type { CommentRefusal } from '../../utils/comment-refusal';

type Notice = Exclude<CommentRefusal, { kind: 'slow-mode' }>;

interface NoticeViewProps {
  notice: Notice;
  channelId: string | undefined;
  onSubscribed: () => void;
}

function NoticeView({ notice, channelId, onSubscribed }: NoticeViewProps) {
  const { tOr } = useT();
  const { format } = useFormat();
  const subscribe = useSetSubscription(channelId ?? '');
  const when = (instant: string, type: 'date' | 'dateTime') =>
    unwrapOr(format({ type, value: instant, options: { style: 'medium' } }), instant);

  switch (notice.kind) {
    case 'comments-disabled':
      return <Callout.Title>{tOr('watch.commentsOff', {}, '')}</Callout.Title>;
    case 'banned':
      return (
        <>
          <Callout.Title>{tOr('watch.commentsBanned', {}, '')}</Callout.Title>
          <Callout.Body>
            {notice.reason && (
              <p className="m-0">
                {tOr('watch.commentsBannedReason', { reason: notice.reason }, '')}
              </p>
            )}
            <p className="m-0">
              {notice.expiresAt
                ? tOr('watch.commentsBannedUntil', { date: when(notice.expiresAt, 'dateTime') }, '')
                : tOr('watch.commentsBannedForever', {}, '')}
            </p>
          </Callout.Body>
        </>
      );
    case 'subscribers-only':
      return (
        <>
          <Callout.Title>{tOr('watch.commentsSubscribersOnly', {}, '')}</Callout.Title>
          {channelId && (
            <Callout.Action>
              <Button
                variant="solid"
                size="sm"
                loading={subscribe.isPending}
                onClick={() => subscribe.mutate(true, { onSuccess: onSubscribed })}
              >
                {tOr('watch.commentsSubscribe', {}, '')}
              </Button>
            </Callout.Action>
          )}
        </>
      );
    case 'account-too-new':
      return (
        <Callout.Title>
          {tOr('watch.commentsAccountTooNew', { date: when(notice.opensAt, 'date') }, '')}
        </Callout.Title>
      );
  }
}

export interface CommentComposerProps {
  videoId: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  /** Why the last post was refused, if it was. */
  refusal: CommentRefusal | null;
  /** When slow mode lets the next comment through, in ms. */
  waitUntil: number | null;
  /** The viewer subscribed from the notice, so the refusal no longer stands. */
  onSubscribed: () => void;
}

/** The place to write a comment, or the reason there is none: comments off, a ban, subscribers only or an account too new, each in place of the field; slow mode on its button. */
export function CommentComposer({
  videoId,
  value,
  onChange,
  onSubmit,
  submitting,
  refusal,
  waitUntil,
  onSubscribed,
}: CommentComposerProps) {
  const api = useApi();
  const { tOr } = useT();
  const account = useAccount();
  const { data: video } = useSuspenseQuery(videoQueryOptions(api, videoId));
  const channelId = video.channel?.id;
  const onTeam = useCan(isChannelTeamMember, {
    channelId: channelId ?? '',
    ownerId: video.ownerId,
  });
  const { data: ban } = useQuery({
    ...ownRestrictionQueryOptions(api, channelId ?? ''),
    enabled: channelId !== undefined,
  });
  const seconds = useCountdown(waitUntil);

  const notice: Notice | null =
    (!(video.commentsEnabled || onTeam) ? { kind: 'comments-disabled' } : null) ??
    (ban ? { kind: 'banned', reason: ban.reason, expiresAt: ban.expiresAt } : null) ??
    (refusal && refusal.kind !== 'slow-mode' ? refusal : null);

  if (notice) {
    return (
      <Callout.Root tone="warning" role="status">
        <Callout.Icon />
        <NoticeView notice={notice} channelId={channelId} onSubscribed={onSubscribed} />
      </Callout.Root>
    );
  }

  return (
    <CommentThread.Composer
      value={value}
      onChange={onChange}
      onSubmit={onSubmit}
      viewerAvatar={account?.channel?.avatarUrl ?? undefined}
      submitting={submitting}
      wait={seconds > 0 ? tOr('watch.commentsSlowMode', { seconds }, '') : undefined}
    />
  );
}
