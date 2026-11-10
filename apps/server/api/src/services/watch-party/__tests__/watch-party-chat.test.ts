import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { pinChat, readRoomChat, removeChat, sendChat } from '../watch-party-chat';
import { keyOf, ROOM_ID, roleIdsOf } from './watch-party-moderation-fixture';
import { socketRoom } from './watch-party-socket-fixture';
import { MEMBER, OTHER, OWNER, userCaller } from './watch-party-test-deps';

type Party = Awaited<ReturnType<typeof socketRoom>>;

const say = (party: Party, text: string, who = MEMBER) =>
  sendChat(party.deps, ROOM_ID, userCaller(who), text);

async function settings(party: Party, patch: { slowModeSeconds?: 10; chatEnabled?: boolean }) {
  const room = await party.room();
  expectOk(
    await party.repositories.watchPartyRooms.updateSettings(
      ROOM_ID,
      patch,
      room.version,
      null,
      party.deps.now()
    )
  );
}

describe('room chat', () => {
  it('stores a line before it publishes it, with its author and where the room was', async () => {
    const party = await socketRoom();
    await party.play(4_000);

    const id = expectOk(await say(party, 'hello there'));

    const stored = expectOk(
      await party.repositories.watchPartyMessages.listAfter(ROOM_ID, null, 50)
    );
    expect(stored.at(-1)).toMatchObject({ id, body: 'hello there', positionMs: 4_000 });
    expect(party.published('chat.message')).toEqual([
      {
        type: 'chat.message',
        message: expect.objectContaining({
          id,
          author: expect.objectContaining({ memberKey: keyOf(MEMBER) }),
        }),
      },
    ]);
  });

  it.each([
    {
      scenario: 'chat switched off',
      patch: { chatEnabled: false },
      code: ErrorCodes.WATCH_PARTY_CHAT_OFF,
    },
    {
      scenario: 'a second line inside slow mode',
      patch: { slowModeSeconds: 10 as const },
      code: ErrorCodes.WATCH_PARTY_SLOW_MODE,
    },
  ])('refuses $scenario', async ({ patch, code }) => {
    const party = await socketRoom();
    await settings(party, patch);

    const first = await say(party, 'one');
    const second = await say(party, 'two');

    expect(expectErr(patch.chatEnabled === false ? first : second).code).toBe(code);
  });

  it('lets the owner post through slow mode', async () => {
    const party = await socketRoom();
    await settings(party, { slowModeSeconds: 10 });

    expectOk(await say(party, 'one', OWNER));

    expectOk(await say(party, 'two', OWNER));
  });

  it('refuses the sixth line in ten seconds', async () => {
    const party = await socketRoom();
    for (let line = 0; line < 5; line += 1) expectOk(await say(party, `line ${line}`));

    expect(expectErr(await say(party, 'too many')).code).toBe(ErrorCodes.RATE_LIMITED);
  });

  it('refuses a muted member’s line', async () => {
    const party = await socketRoom();
    const roles = await roleIdsOf(party.repositories, party.deps.now());
    expectOk(
      await party.repositories.watchPartyRoles.assign(
        {
          roomId: ROOM_ID,
          memberKey: keyOf(MEMBER),
          roleId: roles.chat_muted,
          grantedBy: keyOf(OWNER),
          expiresAt: null,
          createdAt: party.deps.now(),
        },
        {
          line: {
            id: party.deps.secrets.newId(),
            line: { event: 'role_assigned', actorKey: null, targetKey: null, detail: null },
            videoId: null,
            positionMs: null,
            createdAt: party.deps.now(),
          },
          at: party.deps.now(),
        }
      )
    );

    expect(expectErr(await say(party, 'hi'))).toMatchObject({
      code: ErrorCodes.WATCH_PARTY_PERMISSION_MISSING,
      permission: 'chat.post',
    });
  });

  it('removes a line for a moderator, publishing the removal and a system line', async () => {
    const party = await socketRoom();
    const id = expectOk(await say(party, 'rude'));

    expect(expectErr(await removeChat(party.deps, ROOM_ID, userCaller(MEMBER), id)).code).toBe(
      ErrorCodes.WATCH_PARTY_PERMISSION_MISSING
    );
    expectOk(await removeChat(party.deps, ROOM_ID, userCaller(OWNER), id));

    expect(party.published('chat.removed')).toEqual([{ type: 'chat.removed', id }]);
    expect(party.published('chat.message').at(-1)?.message.system).toMatchObject({
      event: 'message_removed',
      detail: id,
    });
  });

  it('lets a moderator remove a member’s line but not the owner’s', async () => {
    const party = await socketRoom({ members: [MEMBER, OTHER] });
    const roles = await roleIdsOf(party.repositories, party.deps.now());
    expectOk(
      await party.repositories.watchPartyRoles.assign(
        {
          roomId: ROOM_ID,
          memberKey: keyOf(MEMBER),
          roleId: roles.moderator,
          grantedBy: keyOf(OWNER),
          expiresAt: null,
          createdAt: party.deps.now(),
        },
        {
          line: {
            id: party.deps.secrets.newId(),
            line: { event: 'role_assigned', actorKey: null, targetKey: null, detail: null },
            videoId: null,
            positionMs: null,
            createdAt: party.deps.now(),
          },
          at: party.deps.now(),
        }
      )
    );
    const theirs = expectOk(await say(party, 'rude', OTHER));
    const owners = expectOk(await say(party, 'house rule', OWNER));

    expect(expectErr(await removeChat(party.deps, ROOM_ID, userCaller(MEMBER), owners)).code).toBe(
      ErrorCodes.WATCH_PARTY_ROLE_ESCALATION
    );
    expectOk(await removeChat(party.deps, ROOM_ID, userCaller(MEMBER), theirs));

    expect(party.published('chat.removed')).toEqual([{ type: 'chat.removed', id: theirs }]);
  });

  it('lets the owner remove their own line', async () => {
    const party = await socketRoom();
    const id = expectOk(await say(party, 'oops', OWNER));

    expectOk(await removeChat(party.deps, ROOM_ID, userCaller(OWNER), id));

    expect(party.published('chat.removed')).toEqual([{ type: 'chat.removed', id }]);
  });

  it('pins one line and unpins it, publishing each', async () => {
    const party = await socketRoom();
    const id = expectOk(await say(party, 'pin me'));

    expectOk(await pinChat(party.deps, ROOM_ID, userCaller(OWNER), id));
    expectOk(await pinChat(party.deps, ROOM_ID, userCaller(OWNER), null));

    expect(party.published('chat.pinned').map(({ message }) => message?.id ?? null)).toEqual([
      id,
      null,
    ]);
  });

  it('replays the lines after a cursor, with the pinned one', async () => {
    const party = await socketRoom();
    const first = expectOk(await say(party, 'one', OWNER));
    const second = expectOk(await say(party, 'two', OWNER));
    expectOk(await pinChat(party.deps, ROOM_ID, userCaller(OWNER), first));

    const chat = expectOk(await readRoomChat(party.deps, ROOM_ID, first));

    expect(chat).toMatchObject({ resume: 'replayed', pinned: { id: first } });
    expect(chat.lines.map(({ id }) => id)).toEqual([second]);
  });
});
