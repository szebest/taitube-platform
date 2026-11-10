import { useFormat, useT } from '@vp/intl-react';
import { usePartyCan } from '@vp/permissions-react';
import type { PartyChatLine, WatchPartySocket } from '@vp/queries';
import { unwrapOr } from '@vp/result';
import { MemberMenu, type MemberMuteDuration } from '#app/components/party/member-menu';
import { PartyChat } from '#app/components/party/party-chat';
import { PartyQueue } from '#app/components/party/party-queue';
import { PartyRoom, type PartyRoomTab } from '#app/components/party/party-room';
import { Roster } from '#app/components/party/roster';
import { usePartyModeration } from '#app/features/watch-party/hooks/use-party-moderation';
import { getComposerState } from '#app/features/watch-party/utils/get-composer-state';
import { getMemberSubject } from '#app/features/watch-party/utils/get-member-subject';
import { getRoleBadges } from '#app/features/watch-party/utils/get-role-badges';

const UNASSIGNABLE_ROLES = ['owner', 'member', 'guest', 'chat_muted', 'voice_muted'];

interface PartyPanelProps {
  roomId: string;
  socket: WatchPartySocket;
  tab: PartyRoomTab;
  onTabChange: (tab: PartyRoomTab) => void;
  /** A guest's sign-in bar upgrades the seat. */
  onSignIn: () => void;
}

/** Chat, People and Queue of the room: what the socket's state says, and what the viewer's ability allows. */
export function PartyPanel({ roomId, socket, tab, onTabChange, onSignIn }: PartyPanelProps) {
  const { state, send } = socket;
  const { tOr } = useT();
  const { format } = useFormat();
  const moderation = usePartyModeration(roomId);
  const canPost = usePartyCan({ kind: 'permission', permission: 'chat.post' });
  const { room, you, roles, roster } = state;

  const ownerKey = room?.owner.memberKey ?? '';
  const viewerOwns = you?.memberKey === ownerKey;
  const mutedRole = roles.find((role) => role.key === 'chat_muted');
  const muted = mutedRole !== undefined && (you?.roleIds.includes(mutedRole.id) ?? false);
  const mutedUntil = mutedRole && state.expiries[mutedRole.id];
  const assignable = roles.filter((role) => !UNASSIGNABLE_ROLES.includes(role.key ?? ''));
  const composer = getComposerState({
    connected: state.connection === 'open',
    chatEnabled: state.chatMode?.enabled ?? true,
    guest: you?.kind === 'guest',
    canPost,
    muted,
  });

  const badgesOf = (memberKey: string) =>
    getRoleBadges(
      roster.find((person) => person.memberKey === memberKey),
      roles
    ).map((badge) => <Roster.RoleBadge key={badge.id} name={badge.name} colour={badge.colour} />);

  const lineOf = (line: PartyChatLine) => (
    <PartyChat.Line
      key={line.id}
      author={line.author?.name ?? ''}
      avatarUrl={line.author?.avatarUrl}
      badges={line.author && badgesOf(line.author.memberKey)}
      system={line.kind === 'system'}
    >
      {line.body}
    </PartyChat.Line>
  );

  const mute = (memberKey: string, expiresIn: MemberMuteDuration) => {
    if (mutedRole) {
      moderation.mutate({ type: 'assign', memberKey, roleId: mutedRole.id, expiresIn });
    }
  };

  const present = roster.filter((person) => !person.away);
  const away = roster.filter((person) => person.away);

  const memberOf = (person: (typeof roster)[number]) => (
    <Roster.Member
      key={person.memberKey}
      name={person.name}
      avatarUrl={person.avatarUrl}
      source={person.source}
      owner={person.memberKey === ownerKey}
      away={person.away}
      ready={person.ready}
      sync={person.sync}
      badges={badgesOf(person.memberKey)}
      menu={
        person.memberKey === you?.memberKey ? null : (
          <MemberMenu
            name={person.name}
            member={getMemberSubject(person, roles, ownerKey)}
            roles={assignable.map((role) => ({
              id: role.id,
              name: role.name,
              key: role.key,
              position: role.position,
              assigned: person.roleIds.includes(role.id),
            }))}
            canTransfer={viewerOwns}
            onToggleRole={(roleId, assigned) =>
              moderation.mutate({
                type: assigned ? 'assign' : 'revoke',
                memberKey: person.memberKey,
                roleId,
              })
            }
            onMute={(_scope, duration) => mute(person.memberKey, duration)}
            onKick={() => moderation.mutate({ type: 'kick', memberKey: person.memberKey })}
            onBan={() => moderation.mutate({ type: 'ban', memberKey: person.memberKey })}
            onTransfer={() => moderation.mutate({ type: 'transfer', memberKey: person.memberKey })}
          />
        )
      }
    />
  );

  return (
    <PartyRoom.Panel value={tab} onValueChange={onTabChange}>
      <PartyRoom.Tabs />
      <PartyRoom.TabPanel value="chat">
        <PartyChat.Root onSend={(message) => send({ type: 'chat.send', message })}>
          {state.pinned && <PartyChat.Pinned>{state.pinned.body}</PartyChat.Pinned>}
          <PartyChat.List>{state.lines.map(lineOf)}</PartyChat.List>
          <PartyChat.Composer
            state={composer}
            mutedUntil={
              mutedUntil
                ? unwrapOr(
                    format({ type: 'time', value: mutedUntil, options: { style: 'short' } }),
                    ''
                  )
                : undefined
            }
            onSignIn={onSignIn}
          />
        </PartyChat.Root>
      </PartyRoom.TabPanel>
      <PartyRoom.TabPanel value="people">
        <Roster.Root>
          <Roster.Group label={tOr('party.rosterPresent', {}, '')} count={present.length}>
            {present.map(memberOf)}
          </Roster.Group>
          {away.length > 0 && (
            <Roster.Group label={tOr('party.rosterAway', {}, '')} count={away.length}>
              {away.map(memberOf)}
            </Roster.Group>
          )}
          <Roster.Guests count={state.guests} />
        </Roster.Root>
      </PartyRoom.TabPanel>
      <PartyRoom.TabPanel value="queue">
        <PartyQueue.Root>
          {state.queue.items.length === 0 ? (
            <PartyQueue.Empty />
          ) : (
            <PartyQueue.List>
              {state.queue.items.map((item) => (
                <PartyQueue.Item
                  key={item.id}
                  title={item.video.title ?? ''}
                  thumbnailUrl={item.video.thumbnailUrl}
                  addedBy={roster.find((person) => person.memberKey === item.addedBy)?.name ?? ''}
                  current={item.id === state.playback.itemId}
                />
              ))}
            </PartyQueue.List>
          )}
        </PartyQueue.Root>
      </PartyRoom.TabPanel>
    </PartyRoom.Panel>
  );
}
