import { EmptyState } from '@kit/components';
import type { FormatValue } from '@kit/intl';
import { Format, useT } from '@kit/intl-react';
import { Badge, type BadgeTone, Button, Skeleton, Table, useToast } from '@kit/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { SHARE_TOKEN_PARAM, type ShareLinkView, type Video } from '@vp/api-contracts';
import type { ShareLinkState } from '@vp/domain';
import { shareLinksQueryOptions, useApi, useFailureToast } from '@vp/queries';
import { revokeShareLinkMutationOptions } from '#app/features/videos/api/video-tool-mutations';
import { useCopyField } from '#app/hooks/use-copy-field';
import { WEB_URL } from '#app/lib/config';
import { CreateShareLinkForm } from '../create-share-link-form/create-share-link-form';

/** Only an active link can still be copied or revoked. */
const STATE_VIEW = {
  active: { tone: 'success', usable: true },
  expired: { tone: 'neutral', usable: false },
  revoked: { tone: 'danger', usable: false },
} as const satisfies Record<ShareLinkState, { tone: BadgeTone; usable: boolean }>;

const count = (value: number): FormatValue => ({ type: 'number', value });

const watchTime = (seconds: number): FormatValue => ({
  type: 'duration',
  value: seconds,
  options: { style: 'words', unitDisplay: 'short' },
});

/** The links that let anyone holding one watch this video, with what each brought in. */
export function ShareLinksSection({ video }: { video: Video }) {
  const api = useApi();
  const { tOr } = useT();
  const toast = useToast();
  const showFailure = useFailureToast();
  const copy = useCopyField();
  const links = useQuery(shareLinksQueryOptions(api, video.id));
  const revoke = useMutation(revokeShareLinkMutationOptions(api, video.id));

  const items = links.data?.items ?? [];
  const active = items.filter(({ state }) => STATE_VIEW[state].usable).length;
  const nameOf = (link: ShareLinkView) => link.label ?? tOr('studio.shareLinkNoLabel', {}, '');
  const addressOf = (link: ShareLinkView) =>
    `${WEB_URL}/watch/${video.id}?${new URLSearchParams({ [SHARE_TOKEN_PARAM]: link.token })}`;

  const revokeLink = (link: ShareLinkView) =>
    revoke.mutate(link.id, {
      onSuccess: () => toast({ tone: 'success', title: tOr('studio.shareLinkRevoked', {}, '') }),
      onError: (error) => showFailure(tOr('studio.shareLinkRevokeFailed', {}, ''), error),
    });

  return (
    <section className="flex flex-col gap-stack" aria-labelledby="share-links-title">
      <header className="flex flex-col gap-inline">
        <h2 id="share-links-title">{tOr('studio.shareLinksTitle', {}, '')}</h2>
        <p className="m-0 text-fg-muted">{tOr('studio.shareLinksDescription', {}, '')}</p>
      </header>
      <CreateShareLinkForm videoId={video.id} active={active} />
      {links.isPending && <Skeleton className="h-32 w-full" />}
      {links.isError && <p role="alert">{tOr('studio.shareLinksLoadFailed', {}, '')}</p>}
      {links.isSuccess && items.length === 0 && (
        <EmptyState.Root size="section">
          <EmptyState.Title>{tOr('studio.shareLinksEmpty', {}, '')}</EmptyState.Title>
        </EmptyState.Root>
      )}
      {items.length > 0 && (
        <Table.Root size="sm" aria-label={tOr('studio.shareLinksTableLabel', {}, '')}>
          <Table.Header>
            <Table.Row>
              <Table.Head>{tOr('studio.shareLinksColumnLabel', {}, '')}</Table.Head>
              <Table.Head>{tOr('studio.shareLinksColumnState', {}, '')}</Table.Head>
              <Table.Head>{tOr('studio.shareLinksColumnExpires', {}, '')}</Table.Head>
              <Table.Head align="end">{tOr('studio.shareLinksColumnOpens', {}, '')}</Table.Head>
              <Table.Head align="end">{tOr('studio.shareLinksColumnViews', {}, '')}</Table.Head>
              <Table.Head align="end">{tOr('studio.shareLinksColumnWatchTime', {}, '')}</Table.Head>
              <Table.Head align="end">{tOr('studio.shareLinksColumnActions', {}, '')}</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {items.map((link) => (
              <Table.Row key={link.id}>
                <Table.Cell className={link.label === null ? 'text-fg-muted' : undefined}>
                  {nameOf(link)}
                </Table.Cell>
                <Table.Cell>
                  <Badge size="sm" tone={STATE_VIEW[link.state].tone}>
                    {tOr('studio.shareLinkState', { state: link.state }, link.state)}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  {link.expiresAt === null ? (
                    tOr('studio.shareLinkNeverExpires', {}, '')
                  ) : (
                    <time dateTime={link.expiresAt}>
                      <Format value={{ type: 'dateTime', value: link.expiresAt }} />
                    </time>
                  )}
                </Table.Cell>
                <Table.Cell align="end" className="tabular-nums">
                  <Format value={count(link.stats.opens)} />
                </Table.Cell>
                <Table.Cell align="end" className="tabular-nums">
                  <Format value={count(link.stats.views)} />
                </Table.Cell>
                <Table.Cell align="end" className="tabular-nums">
                  <Format value={watchTime(link.stats.watchSeconds)} />
                </Table.Cell>
                <Table.Cell align="end">
                  {STATE_VIEW[link.state].usable && (
                    <span className="inline-flex gap-inline">
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={tOr('studio.shareLinkCopyFor', { label: nameOf(link) }, '')}
                        onClick={() =>
                          void copy(tOr('studio.shareLinkCopied', {}, ''), addressOf(link))
                        }
                      >
                        {tOr('studio.shareLinkCopy', {}, '')}
                      </Button>
                      <Button
                        variant="outline"
                        tone="danger"
                        size="sm"
                        aria-label={tOr('studio.shareLinkRevokeFor', { label: nameOf(link) }, '')}
                        onClick={() => revokeLink(link)}
                      >
                        {tOr('studio.shareLinkRevoke', {}, '')}
                      </Button>
                    </span>
                  )}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      )}
    </section>
  );
}
