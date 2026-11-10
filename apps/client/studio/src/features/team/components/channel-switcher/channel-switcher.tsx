import { useT } from '@vp/intl-react';
import { useAccount } from '@vp/queries';
import { Avatar, Button, DropdownMenu, Icon } from '@vp/ui';
import { useState } from 'react';
import { RoleBadge } from '#app/components/team/role-badge';
import { useSwitchChannel } from '#app/features/team/hooks/use-switch-channel';
import { useActiveChannel } from '#app/hooks/use-active-channel';
import { LeaveTeamDialog } from '../leave-team-dialog/leave-team-dialog';
import { LeaveTeamItem } from '../leave-team-item/leave-team-item';

const OWN = 'own';

function ChannelAvatar({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  return (
    <Avatar.Root size="sm">
      {imageUrl ? <Avatar.Image src={imageUrl} alt="" /> : null}
      <Avatar.Fallback aria-hidden="true">{name.slice(0, 1).toUpperCase()}</Avatar.Fallback>
    </Avatar.Root>
  );
}

/** Which channel the studio works on, and the way to another one the viewer is a member of; nothing for a viewer who has none. */
export function ChannelSwitcher() {
  const { tOr } = useT();
  const account = useAccount();
  const { channelId, own, memberships } = useActiveChannel();
  const switchTo = useSwitchChannel();
  const [leaving, setLeaving] = useState(false);

  if (!account || memberships.length === 0) {
    return null;
  }

  const held = own ? undefined : memberships.find((item) => item.channelId === channelId);
  const shown = own ? account.channel : held?.channel;
  if (!shown) {
    return null;
  }

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between"
            aria-label={tOr('studio.channelSwitch', {}, '')}
          >
            <span className="flex min-w-0 items-center gap-inline">
              <ChannelAvatar name={shown.displayName} imageUrl={shown.avatarUrl} />
              <span className="truncate">{shown.displayName}</span>
            </span>
            <Icon name="chevron-down" size="sm" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="start" className="min-w-56">
          <DropdownMenu.Label>{tOr('studio.channelSwitchLabel', {}, '')}</DropdownMenu.Label>
          <DropdownMenu.RadioGroup
            value={own ? OWN : channelId}
            onValueChange={(next) => {
              if (next === OWN) {
                void switchTo(undefined, 'owner');
                return;
              }
              const target = memberships.find((item) => item.channelId === next);
              if (target) void switchTo(target.channelId, target.role);
            }}
          >
            <DropdownMenu.RadioItem value={OWN}>
              {tOr('studio.channelSwitchOwn', { name: account.channel.displayName }, '')}
            </DropdownMenu.RadioItem>
            {memberships.map((item) => (
              <DropdownMenu.RadioItem key={item.channelId} value={item.channelId}>
                <span className="flex w-full items-center justify-between gap-inline">
                  {item.channel.displayName}
                  <RoleBadge channelRole={item.role}>
                    {tOr('studio.teamRole', { role: item.role }, '')}
                  </RoleBadge>
                </span>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
          {held && <LeaveTeamItem membership={held} onLeave={() => setLeaving(true)} />}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      {leaving && held && <LeaveTeamDialog membership={held} onClose={() => setLeaving(false)} />}
    </>
  );
}
