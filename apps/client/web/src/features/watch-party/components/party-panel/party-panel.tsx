import { useFormat } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';
import { usePartyCan } from '@vp/permissions-react';
import type { PartyChatLine, WatchPartySocket } from '@vp/queries';
import { useState } from 'react';
import {
  MemberMenu,
  type MemberMuteDuration,
  type MemberMuteScope,
  MemberPersonalControls,
} from '#app/components/party/member-menu';
import { PartyChat } from '#app/components/party/party-chat';
import { PartyRoom, type PartyRoomTab } from '#app/components/party/party-room';
import { Roster } from '#app/components/party/roster';
import { PartyQueueTab } from '#app/features/watch-party/components/party-queue-tab/party-queue-tab';
import { usePartyControls } from '#app/features/watch-party/hooks/use-party-controls';
import { usePartyModeration } from '#app/features/watch-party/hooks/use-party-moderation';
import { getComposerState } from '#app/features/watch-party/utils/get-composer-state';
import { getMemberSubject } from '#app/features/watch-party/utils/get-member-subject';
import { getRoleBadges } from '#app/features/watch-party/utils/get-role-badges';
import { useT } from '#app/lib/messages';

const MUTE_ROLE = { chat: 'chat_muted', voice: 'voice_muted' } as const;

const UNASSIGNABLE_ROLES = ['owner', 'member', 'guest', 'chat_muted', 'voice_muted'];

interface PartyPanelProps {
  roomId: string;
  socket: WatchPartySocket;
  tab: PartyRoomTab;
  onTabChange: (tab: PartyRoomTab) => void;
  /** A guest's sign-in bar upgrades the seat. */
  onSignIn: () => void;
  /** Voice is on in the room, so "Mute in voice" is offered. */
  voice?: boolean;
}

/** Chat, People and Queue of the room: what the socket's state says, and what the viewer's ability allows. */
export function PartyPanel({
  roomId,
  socket,
  tab,
  onTabChange,
  onSignIn,
  voice = false,
}: PartyPanelProps) {
  const { state, send } = socket;
  const { tOr } = useT();
  const { format } = useFormat();
  const moderation = usePartyModeration(roomId);
  const controls = usePartyControls(roomId, state.you?.kind);
  const [shown, setShown] = useState<ReadonlySet<string>>(new Set());
  const canPost = usePartyCan({ kind: 'permission', permission: 'chat.post' });
  const { room, you, roles, roster } = state;

  const ownerKey = room?.owner.memberKey ?? '';
  const viewerOwns = you?.memberKey === ownerKey;
  const mutedRole = roles.find((role) => role.key === MUTE_ROLE.chat);
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

  const lineOf = (line: PartyChatLine) => {
    const author = line.author && controls.resolved(line.author.memberKey);

    return (
      <PartyChat.Line
        key={line.id}
        author={line.author?.name ?? ''}
        avatarUrl={author?.hideAvatar ? null : line.author?.avatarUrl}
        badges={line.author && badgesOf(line.author.memberKey)}
        system={line.kind === 'system'}
        hidden={Boolean(author?.hideMessages) && !shown.has(line.id)}
        onShow={() => setShown((current) => new Set(current).add(line.id))}
      >
        {line.body}
      </PartyChat.Line>
    );
  };

  const mute = (memberKey: string, scope: MemberMuteScope, expiresIn: MemberMuteDuration) => {
    const role = roles.find((entry) => entry.key === MUTE_ROLE[scope]);
    if (role) {
      moderation.mutate({ type: 'assign', memberKey, roleId: role.id, expiresIn });
    }
  };

  const favouritesFirst = (people: typeof roster) =>
    people.toSorted(
      (first, second) =>
        Number(controls.resolved(second.memberKey).favourite) -
        Number(controls.resolved(first.memberKey).favourite)
    );
  const present = favouritesFirst(roster.filter((person) => !person.away));
  const away = favouritesFirst(roster.filter((person) => person.away));

  const memberOf = (person: (typeof roster)[number]) => {
    const own = controls.resolved(person.memberKey);
    const markKind = own.hideMessages ? 'hidden' : own.voiceMuted ? 'muted' : null;

    return (
      <Roster.Member
        key={person.memberKey}
        name={person.name}
        avatarUrl={person.avatarUrl}
        avatarHidden={own.hideAvatar}
        favourite={own.favourite}
        source={person.source}
        owner={person.memberKey === ownerKey}
        away={person.away}
        ready={person.ready}
        sync={person.sync}
        badges={badgesOf(person.memberKey)}
        mark={
          markKind && (
            <Roster.ControlMark
              name={person.name}
              kind={markKind}
              onUndo={() => controls.clear(person.memberKey)}
            />
          )
        }
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
              voice={voice}
              canTransfer={viewerOwns}
              personalControls={
                <MemberPersonalControls
                  room={controls.scoped(person.memberKey, 'room')}
                  everywhere={controls.scoped(person.memberKey, 'everywhere')}
                  everywhereAllowed={controls.everywhereAllowed}
                  onChange={(scope, patch) => controls.set(person.memberKey, scope, patch)}
                />
              }
              onToggleRole={(roleId, assigned) =>
                moderation.mutate({
                  type: assigned ? 'assign' : 'revoke',
                  memberKey: person.memberKey,
                  roleId,
                })
              }
              onMute={(scope, duration) => mute(person.memberKey, scope, duration)}
              onKick={() => moderation.mutate({ type: 'kick', memberKey: person.memberKey })}
              onBan={() => moderation.mutate({ type: 'ban', memberKey: person.memberKey })}
              onTransfer={() =>
                moderation.mutate({ type: 'transfer', memberKey: person.memberKey })
              }
            />
          )
        }
      />
    );
  };

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
        <PartyQueueTab roomId={roomId} socket={socket} />
      </PartyRoom.TabPanel>
    </PartyRoom.Panel>
  );
}
