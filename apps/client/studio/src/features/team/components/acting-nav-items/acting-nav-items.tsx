import { Link, useMatchRoute } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import {
  canModerateComments,
  canReadAnalytics,
  canReadChannelTeam,
  canUpdateLiveStream,
  canUpdateVideo,
} from '@vp/permissions';
import { Can } from '@vp/permissions-react';
import { useAccount } from '@vp/queries';
import { StudioWorkspace } from '#app/components/workspace/studio-workspace';
import { ChannelSwitcher } from '#app/features/team/components/channel-switcher/channel-switcher';
import { useActiveChannel } from '#app/features/team/hooks/use-active-channel';
import { InvitesNavItem } from '../invites-nav-item/invites-nav-item';

export interface ActingNavItemsProps {
  /** A comment arrived on a page other than the inbox. */
  newComments: boolean;
}

function SignedInNavItems({ newComments }: ActingNavItemsProps) {
  const matchRoute = useMatchRoute();
  const { tOr } = useT();
  const { channelId, ownerId } = useActiveChannel();

  return (
    <>
      <ChannelSwitcher />
      <Can type="rule" I={canUpdateVideo} this={{ video: { ownerId } }}>
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
      <Can type="rule" I={canReadAnalytics} this={{ analytics: { ownerId } }}>
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
      <Can type="rule" I={canModerateComments} this={{ videoOwnerId: ownerId }}>
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
    </>
  );
}

/** The studio's pages the viewer's role on the acting channel reaches, behind the switcher between channels; none for a guest. */
export function ActingNavItems(props: ActingNavItemsProps) {
  return useAccount() ? <SignedInNavItems {...props} /> : null;
}
