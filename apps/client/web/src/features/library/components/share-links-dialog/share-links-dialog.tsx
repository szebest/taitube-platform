import { SectionError } from '@kit/components';
import { useFormat } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';
import { Badge, type BadgeTone, Button, Skeleton } from '@kit/ui';
import { useQuery } from '@tanstack/react-query';
import { type PlaylistView, SHARE_TOKEN_PARAM, type ShareLinkView } from '@vp/api-contracts';
import type { ShareLinkState } from '@vp/domain';
import { useApi } from '@vp/queries';
import { playlistShareLinksQueryOptions } from '#app/features/library/api/playlist-queries';
import { useShareLinkChanges } from '#app/features/library/hooks/use-share-link-changes';
import { useCopyLink } from '#app/hooks/use-copy-link';
import { useT } from '#app/lib/messages';
import { urlModals } from '#app/lib/url-modal/registry';
import { NewShareLinkForm } from './components/new-share-link-form/new-share-link-form';

const { UrlModal } = urlModals;

const STATE_TONE = {
  active: 'success',
  expired: 'neutral',
  revoked: 'danger',
} as const satisfies Record<ShareLinkState, BadgeTone>;

export interface ShareLinksDialogProps {
  playlist: PlaylistView;
}

/** `?modal=playlist-share-links`: the owner's links that open this playlist whatever its visibility. */
export function ShareLinksDialog({ playlist }: ShareLinksDialogProps) {
  const { tOr } = useT();
  const { format } = useFormat();
  const copyLink = useCopyLink();
  const links = useQuery(playlistShareLinksQueryOptions(useApi(), playlist.id));
  const { revoke } = useShareLinkChanges(playlist.id);

  const items = links.data?.items ?? [];
  const active = items.filter(({ state }) => state === 'active').length;
  const nameOf = (link: ShareLinkView) => link.label ?? tOr('playlistTools.noLabel', {}, '');

  const copy = ({ token }: ShareLinkView) =>
    copyLink(
      `${window.location.origin}/playlist?${new URLSearchParams({ list: playlist.id, [SHARE_TOKEN_PARAM]: token })}`
    );

  return (
    <UrlModal.Root id="playlist-share-links">
      <UrlModal.Content size="lg">
        <UrlModal.Title>{tOr('playlistTools.shareLinksTitle', {}, '')}</UrlModal.Title>
        <UrlModal.Description>
          {tOr('playlistTools.shareLinksDescription', {}, '')}
        </UrlModal.Description>
        <UrlModal.Body className="flex flex-col gap-section">
          <NewShareLinkForm playlistId={playlist.id} active={active} />
          {links.isPending && <Skeleton aria-hidden="true" className="h-24 w-full" />}
          {links.isError && (
            <SectionError.Root
              role="alert"
              retrying={links.isFetching}
              onRetry={() => void links.refetch()}
            >
              <SectionError.Message>
                {tOr('playlistTools.linksLoadFailed', {}, '')}
              </SectionError.Message>
            </SectionError.Root>
          )}
          {links.isSuccess && items.length === 0 && (
            <p className="m-0 text-body-sm text-fg-muted">
              {tOr('playlistTools.linksEmpty', {}, '')}
            </p>
          )}
          {items.length > 0 && (
            <ul
              aria-label={tOr('playlistTools.linksLabel', {}, '')}
              className="m-0 flex list-none flex-col gap-stack p-0"
            >
              {items.map((link) => (
                <li key={link.id} className="flex min-w-0 flex-wrap items-center gap-inline">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span
                      className={
                        link.label === null ? 'truncate text-fg-muted' : 'truncate text-label'
                      }
                    >
                      {nameOf(link)}
                    </span>
                    <span className="text-caption text-fg-muted">
                      {tOr('playlistTools.opens', { count: link.stats.opens }, '')}
                      {' · '}
                      {link.expiresAt === null
                        ? tOr('playlistTools.neverExpires', {}, '')
                        : tOr(
                            'playlistTools.expires',
                            {
                              date: unwrapOr(
                                format({ type: 'dateTime', value: link.expiresAt }),
                                ''
                              ),
                            },
                            ''
                          )}
                    </span>
                  </div>
                  <Badge size="sm" tone={STATE_TONE[link.state]}>
                    {tOr('playlistTools.linkState', { state: link.state }, '')}
                  </Badge>
                  {link.state === 'active' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={tOr('playlistTools.copyFor', { label: nameOf(link) }, '')}
                        onClick={() => void copy(link)}
                      >
                        {tOr('playlistTools.copy', {}, '')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        tone="danger"
                        aria-label={tOr('playlistTools.revokeFor', { label: nameOf(link) }, '')}
                        onClick={() => revoke.mutate(link.id)}
                      >
                        {tOr('playlistTools.revoke', {}, '')}
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </UrlModal.Body>
      </UrlModal.Content>
    </UrlModal.Root>
  );
}
