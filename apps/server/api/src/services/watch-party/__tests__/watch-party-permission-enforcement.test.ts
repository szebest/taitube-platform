import {
  PENDING_ENFORCEMENT,
  WATCH_PARTY_PERMISSIONS,
  type WatchPartyPermission,
} from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import type { PartyCaller } from '../party-caller';
import { pinChat, removeChat, sendChat } from '../watch-party-chat';
import { runCommand } from '../watch-party-commands';
import { WatchPartyInviteService } from '../watch-party-invite-service';
import { joinRoom } from '../watch-party-join';
import { WatchPartyMemberService } from '../watch-party-member-service';
import { WatchPartyQueueService } from '../watch-party-queue-service';
import { WatchPartyRoleService } from '../watch-party-role-service';
import { closeRoom, updateRoom } from '../watch-party-settings';
import { react, requestPlayback, voteSkip } from '../watch-party-signals';
import { assignRoleId, createRole, fillPresence } from './watch-party-access-fixture';
import { keyOf, ROOM_ID } from './watch-party-moderation-fixture';
import { socketRoom } from './watch-party-socket-fixture';
import { MEMBER, OTHER, OWNER, userCaller, VIDEO_B } from './watch-party-test-deps';

type Party = Awaited<ReturnType<typeof socketRoom>>;
type Attempt = (party: Party, caller: PartyCaller) => Promise<{ ok: boolean; error?: unknown }>;

interface Refusal {
  readonly code: string;
  readonly permission?: string;
}

interface Enforcement {
  /** What the caller holds besides the permission under test, so the action reaches its check. */
  readonly alongside?: readonly WatchPartyPermission[];
  readonly before?: (party: Party) => Promise<void>;
  readonly attempt: Attempt;
  /** Missing permission unless the guarded rule answers with its own refusal. */
  readonly refusal?: Refusal;
}

const POSITION = 450;
const MISSING = ErrorCodes.WATCH_PARTY_PERMISSION_MISSING;

const outcomeOf = (result: { ok: boolean }) => result as { ok: boolean; error?: unknown };

async function versions(party: Party) {
  const { playbackVersion, rolesVersion } = await party.room();
  return { version: playbackVersion, rolesVersion };
}

const command =
  (frame: 'pause' | 'next'): Attempt =>
  async (party, caller) =>
    outcomeOf(
      await runCommand(
        party.deps,
        ROOM_ID,
        caller,
        frame === 'pause'
          ? { type: 'pause', positionMs: 1_000, ...(await versions(party)) }
          : { type: 'next', ...(await versions(party)) },
        () => undefined
      )
    );

const settings =
  (change: Record<string, unknown>): Attempt =>
  async (party, caller) =>
    outcomeOf(
      await updateRoom(party.deps, ROOM_ID, caller, {
        ...change,
        version: (await party.room()).version,
      })
    );

async function chatLine(party: Party) {
  return expectOk(await sendChat(party.deps, ROOM_ID, userCaller(OWNER), 'a line'));
}

async function abilityOf(party: Party, caller: PartyCaller) {
  return expectOk(await party.deps.context.load(ROOM_ID, caller)).ability;
}

const ENFORCEMENT: Readonly<Partial<Record<WatchPartyPermission, Enforcement>>> = {
  'playback.control': {
    before: (party) => party.play().then(() => undefined),
    attempt: command('pause'),
  },
  'playback.request': {
    attempt: async (party, caller) =>
      outcomeOf(
        await requestPlayback(party.deps, ROOM_ID, caller, { type: 'request', kind: 'skip' })
      ),
  },
  'queue.add': {
    attempt: async (party, caller) =>
      outcomeOf(
        await new WatchPartyQueueService(party.deps).add(ROOM_ID, caller, { videoId: VIDEO_B })
      ),
  },
  'queue.reorder': {
    attempt: async (party, caller) =>
      outcomeOf(
        await new WatchPartyQueueService(party.deps).move(
          ROOM_ID,
          caller,
          party.items[0]?.id ?? '',
          {
            toIndex: 1,
          }
        )
      ),
  },
  'queue.remove': {
    attempt: async (party, caller) =>
      outcomeOf(
        await new WatchPartyQueueService(party.deps).remove(
          ROOM_ID,
          caller,
          party.items[0]?.id ?? ''
        )
      ),
  },
  'queue.skip': { before: (party) => party.play().then(() => undefined), attempt: command('next') },
  'queue.vote': {
    attempt: async (party, caller) =>
      outcomeOf(await voteSkip(party.deps, ROOM_ID, caller, party.items[0]?.id ?? '')),
  },
  'chat.post': {
    attempt: async (party, caller) =>
      outcomeOf(await sendChat(party.deps, ROOM_ID, caller, 'hello')),
  },
  'chat.react': {
    attempt: async (party, caller) =>
      outcomeOf(
        await react(party.deps, party.socketDeps.reactions, {
          roomId: ROOM_ID,
          memberKey: keyOf(MEMBER),
          emoji: '🎉',
          ability: await abilityOf(party, caller),
        })
      ),
  },
  'chat.pin': {
    attempt: async (party, caller) =>
      outcomeOf(await pinChat(party.deps, ROOM_ID, caller, await chatLine(party))),
  },
  'chat.moderate': {
    attempt: async (party, caller) =>
      outcomeOf(await removeChat(party.deps, ROOM_ID, caller, await chatLine(party))),
  },
  'chat.bypassSlowMode': {
    alongside: ['chat.post'],
    before: async (party) => {
      const room = await party.room();
      expectOk(
        await party.repositories.watchPartyRooms.updateSettings(
          ROOM_ID,
          { slowModeSeconds: 30 },
          room.version,
          null,
          party.deps.now()
        )
      );
      expectOk(await sendChat(party.deps, ROOM_ID, userCaller(MEMBER), 'first'));
    },
    attempt: async (party, caller) =>
      outcomeOf(await sendChat(party.deps, ROOM_ID, caller, 'second')),
    refusal: { code: ErrorCodes.WATCH_PARTY_SLOW_MODE },
  },
  'members.invite': {
    attempt: async (party, caller) =>
      outcomeOf(
        await new WatchPartyInviteService(party.deps).invite(
          ROOM_ID,
          { ...caller, user: MEMBER },
          { userIds: [OTHER.id] }
        )
      ),
  },
  'members.kick': {
    attempt: async (party, caller) =>
      outcomeOf(await new WatchPartyMemberService(party.deps).kick(ROOM_ID, caller, keyOf(OTHER))),
  },
  'members.ban': {
    attempt: async (party, caller) =>
      outcomeOf(
        await new WatchPartyMemberService(party.deps).ban(ROOM_ID, caller, keyOf(OTHER), undefined)
      ),
  },
  'members.joinWhenFull': {
    before: async (party) => {
      const room = await party.room();
      expectOk(
        await party.repositories.watchPartyRooms.updateSettings(
          ROOM_ID,
          { capacity: 2 },
          room.version,
          null,
          party.deps.now()
        )
      );
      await fillPresence(party, ROOM_ID, 2);
    },
    attempt: async (party, caller) => outcomeOf(await joinRoom(party.deps, ROOM_ID, caller, null)),
    refusal: { code: ErrorCodes.WATCH_PARTY_FULL },
  },
  'room.edit': { attempt: settings({ name: 'Renamed' }) },
  'room.schedule': {
    alongside: ['room.edit'],
    attempt: settings({ scheduledFor: '2026-03-02T20:00:00.000Z' }),
  },
  'room.close': {
    attempt: async (party, caller) => outcomeOf(await closeRoom(party.deps, ROOM_ID, caller)),
  },
  'roles.assign': {
    attempt: async (party, caller) => {
      const lower = await createRole(party, ROOM_ID, {
        name: 'Lower',
        position: 100,
        permissions: ['chat.pin'],
      });
      return outcomeOf(
        await new WatchPartyRoleService(party.deps).assign(
          ROOM_ID,
          caller,
          keyOf(OTHER),
          lower,
          undefined
        )
      );
    },
  },
  'roles.manage': {
    attempt: async (party, caller) =>
      outcomeOf(
        await new WatchPartyRoleService(party.deps).create(ROOM_ID, caller, {
          name: 'Crew',
          kind: 'grant',
          permissions: [],
        })
      ),
  },
};

async function stripMember(party: Party): Promise<void> {
  const at = party.deps.now();
  expectOk(
    await party.repositories.watchPartyRoles.resetBuiltIns(
      ROOM_ID,
      [{ key: 'member', permissions: [] }],
      {
        at,
        line: {
          id: party.deps.secrets.newId(),
          line: { event: 'roles_changed', actorKey: keyOf(OWNER), targetKey: null, detail: null },
          videoId: null,
          positionMs: null,
          createdAt: at,
        },
      }
    )
  );
}

async function holding(party: Party, permissions: readonly WatchPartyPermission[]) {
  const role = await createRole(party, ROOM_ID, {
    name: `Holds ${permissions.join()}`,
    position: POSITION,
    permissions: [...permissions],
  });
  await assignRoleId(party, ROOM_ID, keyOf(MEMBER), role);
}

describe('each permission is enforced on the server', () => {
  it.each(WATCH_PARTY_PERMISSIONS.map(({ id }) => ({ id })))(
    '$id refuses a member without it and lets one with it through',
    async ({ id }) => {
      const enforcement = ENFORCEMENT[id];
      if (enforcement === undefined) {
        expect(PENDING_ENFORCEMENT).toContain(id);
        return;
      }
      expect(PENDING_ENFORCEMENT).not.toContain(id);
      const { alongside = [], before, attempt, refusal } = enforcement;

      const without = await socketRoom({ preset: 'public', members: [MEMBER, OTHER] });
      await stripMember(without);
      await holding(without, alongside);
      await before?.(without);
      const refused = await attempt(without, userCaller(MEMBER));

      const withIt = await socketRoom({ preset: 'public', members: [MEMBER, OTHER] });
      await stripMember(withIt);
      await holding(withIt, [...alongside, id]);
      await before?.(withIt);
      const allowed = await attempt(withIt, userCaller(MEMBER));

      expect(refused.ok).toBe(false);
      expect(refused.error).toMatchObject(refusal ?? { code: MISSING, permission: id });
      expect(allowed.error).toBeUndefined();
      expect(allowed.ok).toBe(true);
    }
  );
});
