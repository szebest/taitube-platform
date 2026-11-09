import { useT } from '@vp/intl-react';
import type { WatchPartyMemberSubject } from '@vp/permissions';
import { usePartyCan } from '@vp/permissions-react';
import { DropdownMenu, Icon, IconButton } from '@vp/ui';
import type { ReactNode } from 'react';
import { MUTE_DURATIONS } from './constants';
import type { MemberMenuRole, MemberMuteDuration, MemberMuteScope } from './types';

export interface MemberMenuProps {
  name: string;
  member: WatchPartyMemberSubject;
  /** The roles the viewer sees, each with whether this member holds it. */
  roles: readonly MemberMenuRole[];
  /** Voice is on in the room, so "Mute in voice" is offered beside "Mute in chat". */
  voice?: boolean;
  /** The viewer is the owner and may hand the room over. */
  canTransfer?: boolean;
  /** The viewer's own controls over this member, after the moderation items. */
  personalControls?: ReactNode;
  onToggleRole: (roleId: string, assigned: boolean) => void;
  onMute: (scope: MemberMuteScope, duration: MemberMuteDuration) => void;
  onKick: () => void;
  onBan: () => void;
  onTransfer: () => void;
}

function RoleItem({
  role,
  onToggle,
}: {
  role: MemberMenuRole;
  onToggle: (assigned: boolean) => void;
}) {
  const allowed = usePartyCan({
    kind: 'role',
    action: role.assigned ? 'revoke' : 'assign',
    role: { key: role.key, position: role.position },
  });

  return (
    <DropdownMenu.CheckboxItem
      checked={role.assigned}
      disabled={!allowed}
      onCheckedChange={onToggle}
    >
      {role.name}
    </DropdownMenu.CheckboxItem>
  );
}

function MuteSubmenu({
  label,
  onPick,
}: {
  label: string;
  onPick: (duration: MemberMuteDuration) => void;
}) {
  const { tOr } = useT();

  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger>{label}</DropdownMenu.SubTrigger>
      <DropdownMenu.SubContent>
        {MUTE_DURATIONS.map(({ value, label: durationLabel }) => (
          <DropdownMenu.Item key={value} onSelect={() => onPick(value)}>
            {tOr(durationLabel, {}, '')}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.SubContent>
    </DropdownMenu.Sub>
  );
}

/** What the viewer may do to one member: moderation by their room ability, then their own controls. */
export function MemberMenu({
  name,
  member,
  roles,
  voice = false,
  canTransfer = false,
  personalControls,
  onToggleRole,
  onMute,
  onKick,
  onBan,
  onTransfer,
}: MemberMenuProps) {
  const { tOr } = useT();
  const canAssign = usePartyCan({ kind: 'member', action: 'assign', member });
  const canMute = usePartyCan({ kind: 'member', action: 'mute', member });
  const canKick = usePartyCan({ kind: 'member', action: 'kick', member });
  const canBan = usePartyCan({ kind: 'member', action: 'ban', member });
  const moderates = canAssign || canMute || canKick || canBan || canTransfer;

  if (!(moderates || personalControls)) {
    return null;
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <IconButton size="sm" variant="ghost" aria-label={tOr('party.memberOptions', { name }, '')}>
          <Icon name="more" />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        {canAssign && (
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger>{tOr('party.memberRoles', {}, '')}</DropdownMenu.SubTrigger>
            <DropdownMenu.SubContent>
              {roles.map((role) => (
                <RoleItem
                  key={role.id}
                  role={role}
                  onToggle={(assigned) => onToggleRole(role.id, assigned)}
                />
              ))}
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>
        )}
        {canMute && (
          <MuteSubmenu
            label={tOr('party.memberMuteChat', {}, '')}
            onPick={(duration) => onMute('chat', duration)}
          />
        )}
        {canMute && voice && (
          <MuteSubmenu
            label={tOr('party.memberMuteVoice', {}, '')}
            onPick={(duration) => onMute('voice', duration)}
          />
        )}
        {canKick && (
          <DropdownMenu.Item tone="danger" onSelect={onKick}>
            {tOr('party.memberKick', {}, '')}
          </DropdownMenu.Item>
        )}
        {canBan && (
          <DropdownMenu.Item tone="danger" onSelect={onBan}>
            {tOr('party.memberBan', {}, '')}
          </DropdownMenu.Item>
        )}
        {canTransfer && (
          <DropdownMenu.Item onSelect={onTransfer}>
            {tOr('party.memberTransfer', {}, '')}
          </DropdownMenu.Item>
        )}
        {moderates && personalControls && <DropdownMenu.Separator />}
        {personalControls}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
