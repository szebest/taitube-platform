import { Link, useMatchRoute } from '@tanstack/react-router';
import {
  canManagePost,
  canModerateComments,
  canReadAnalytics,
  canReadChannelTeam,
  canUpdateChannel,
  canUpdateLiveStream,
  canUpdateVideo,
} from '@vp/permissions';
import { Can } from '@vp/permissions-react';
import { useAccount } from '@vp/queries';
import type { ReactNode } from 'react';
import { StudioWorkspace } from '#app/components/workspace/studio-workspace';
import { useActiveChannel } from '#app/hooks/use-active-channel';
import { useT } from '#app/lib/messages';
import { InvitesNavItem } from '../invites-nav-item/invites-nav-item';

export interface ActingNavItemsProps {
  /** A comment arrived on a page other than the inbox. */
  newComments: boolean;
  /** The review queue's entry, shown beside the inbox to whoever moderates comments. */
  reviewQueue?: ReactNode;
}

function SignedInNavItems({ newComments, reviewQueue }: ActingNavItemsProps) {
  const matchRoute = useMatchRoute();
  const { tOr } = useT();
  const { channelId, ownerId } = useActiveChannel();

  return (
    <>
      <Can type="rule" I={canUpdateVideo} this={{ video: { ownerId, channelId } }}>
        <StudioWorkspace.NavItem
          asChild
          icon="video"
          active={Boolean(matchRoute({ to: '/videos', fuzzy: true }))}
        >
          <Link to="/videos" search={{}}>
            {tOr('studio.navLibrary', {}, '')}
          </Link>
        </StudioWorkspace.NavItem>
      </Can>
      <Can type="rule" I={canManagePost} this={{ action: 'create', post: { ownerId, channelId } }}>
        <StudioWorkspace.NavItem asChild icon="chat" active={Boolean(matchRoute({ to: '/posts' }))}>
          <Link to="/posts" search={{}}>
            {tOr('studio.postsNav', {}, '')}
          </Link>
        </StudioWorkspace.NavItem>
      </Can>
      <Can
        type="rule"
        I={canUpdateChannel}
        this={{ channel: { id: channelId, userId: ownerId, ownerId } }}
      >
        <StudioWorkspace.NavItem
          asChild
          icon="layout"
          active={Boolean(matchRoute({ to: '/customization/page' }))}
        >
          <Link to="/customization/page" search={{}}>
            {tOr('studio.pageNav', {}, '')}
          </Link>
        </StudioWorkspace.NavItem>
      </Can>
      <Can type="rule" I={canReadAnalytics} this={{ analytics: { ownerId, channelId } }}>
        <StudioWorkspace.NavItem
          asChild
          icon="chart"
          active={Boolean(matchRoute({ to: '/analytics' }))}
        >
          <Link to="/analytics" search={{}}>
            {tOr('studio.navAnalytics', {}, '')}
          </Link>
        </StudioWorkspace.NavItem>
      </Can>
      <Can
        type="rule"
        I={canModerateComments}
        this={{ videoOwnerId: ownerId, videoChannelId: channelId }}
      >
        <StudioWorkspace.NavItem
          asChild
          icon="chat"
          active={Boolean(matchRoute({ to: '/comments' }))}
          badge={newComments ? tOr('studio.commentsNavNew', {}, '') : undefined}
        >
          <Link to="/comments" search={{}}>
            {tOr('studio.commentsNav', {}, '')}
          </Link>
        </StudioWorkspace.NavItem>
      </Can>
      <Can
        type="rule"
        I={canModerateComments}
        this={{ videoOwnerId: ownerId, videoChannelId: channelId }}
      >
        {reviewQueue}
      </Can>
      <Can type="rule" I={canUpdateLiveStream} this={{ stream: { ownerId } }}>
        <StudioWorkspace.NavItem asChild icon="live" active={Boolean(matchRoute({ to: '/live' }))}>
          <Link to="/live" search={{}}>
            {tOr('studio.liveNav', {}, '')}
          </Link>
        </StudioWorkspace.NavItem>
      </Can>
      <Can type="rule" I={canReadChannelTeam} this={{ channel: { channelId, ownerId } }}>
        <StudioWorkspace.NavItem asChild icon="you" active={Boolean(matchRoute({ to: '/team' }))}>
          <Link to="/team" search={{}}>
            {tOr('studio.teamNav', {}, '')}
          </Link>
        </StudioWorkspace.NavItem>
      </Can>
      <InvitesNavItem />
      <StudioWorkspace.NavItem
        asChild
        icon="command"
        active={Boolean(matchRoute({ to: '/developers' }))}
      >
        <Link to="/developers" search={{}}>
          {tOr('studio.developersNav', {}, '')}
        </Link>
      </StudioWorkspace.NavItem>
    </>
  );
}

/** The studio's pages the viewer's role on the acting channel reaches; none for a guest. */
export function ActingNavItems(props: ActingNavItemsProps) {
  return useAccount() ? <SignedInNavItems {...props} /> : null;
}
