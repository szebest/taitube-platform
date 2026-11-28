import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { seedPrimaryChannel } from '../../__tests__/test-app';
import { PlaylistCollaborationService } from '../playlist-collaboration-service';
import { TEST_NOW } from './service-deps';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-00000000c101', role: 'USER' };
const EDITOR: UserContext = { id: '00000000-0000-7000-8000-00000000c102', role: 'USER' };
const STRANGER: UserContext = { id: '00000000-0000-7000-8000-00000000c103', role: 'USER' };
const PLAYLIST = '00000000-0000-7000-8000-00000000c1a1';

async function setUp() {
  const repositories = new InMemoryRepositories();
  let n = 0;
  const service = new PlaylistCollaborationService({
    playlists: repositories.playlists,
    collaborators: repositories.playlistCollaborators,
    channels: repositories.channels,
    newToken: () => `token-${String(++n).padStart(16, '0')}`,
    newId: () => `00000000-0000-7000-8000-00000000c2${String(++n).padStart(2, '0')}`,
    now: () => TEST_NOW,
  });
  for (const user of [OWNER, EDITOR, STRANGER]) await seedPrimaryChannel(repositories, user.id);
  expectOk(
    await repositories.playlists.create({
      id: PLAYLIST,
      ownerId: OWNER.id,
      title: 'Ours',
      description: '',
      visibility: 'private',
    })
  );
  const handleOf = async (user: UserContext) =>
    expectOk(await repositories.channels.findPrimaryByUserId(user.id))?.handle ?? '';
  return { repositories, service, handleOf };
}

describe('PlaylistCollaborationService', () => {
  it('invites by handle, seats the invitee on accept and lists them with their channel', async () => {
    const { service, handleOf } = await setUp();

    const invite = expectOk(
      await service.invite(OWNER, PLAYLIST, { handle: await handleOf(EDITOR), role: 'editor' })
    );
    const seated = expectOk(await service.accept(EDITOR, invite.token));
    const listed = expectOk(await service.list(EDITOR, PLAYLIST));

    expect(invite).toMatchObject({ role: 'editor', state: 'active', maxUses: 1, useCount: 0 });
    expect(seated).toEqual({ playlistId: PLAYLIST, role: 'editor' });
    expect(listed.items).toMatchObject([
      { userId: EDITOR.id, role: 'editor', channel: { handle: await handleOf(EDITOR) } },
    ]);
  });

  it("keeps the seats the owner manages out of an editor's reach", async () => {
    const { service, handleOf } = await setUp();
    const { token } = expectOk(
      await service.invite(OWNER, PLAYLIST, { handle: await handleOf(EDITOR), role: 'editor' })
    );
    expectOk(await service.accept(EDITOR, token));

    const codes = [
      expectErr(await service.createLink(EDITOR, PLAYLIST, { role: 'editor', maxUses: null })).code,
      expectErr(await service.remove(EDITOR, PLAYLIST, OWNER.id)).code,
      expectErr(await service.listInvites(EDITOR, PLAYLIST)).code,
      expectErr(await service.list(STRANGER, PLAYLIST)).code,
    ];

    expect(codes).toEqual([
      ErrorCodes.FORBIDDEN,
      ErrorCodes.FORBIDDEN,
      ErrorCodes.FORBIDDEN,
      ErrorCodes.PLAYLIST_NOT_FOUND,
    ]);
  });

  it('changes a role, removes a seat, and answers a seat that is gone', async () => {
    const { service, handleOf } = await setUp();
    const { token } = expectOk(
      await service.invite(OWNER, PLAYLIST, { handle: await handleOf(EDITOR), role: 'editor' })
    );
    expectOk(await service.accept(EDITOR, token));

    expectOk(await service.changeRole(OWNER, PLAYLIST, EDITOR.id, 'contributor'));
    expectOk(await service.leave(EDITOR, PLAYLIST));

    expect(expectErr(await service.remove(OWNER, PLAYLIST, EDITOR.id)).code).toBe(
      ErrorCodes.PLAYLIST_COLLABORATOR_NOT_FOUND
    );
  });

  it('lets the invitee decline, and nobody else', async () => {
    const { service, handleOf } = await setUp();
    const { token } = expectOk(
      await service.invite(OWNER, PLAYLIST, { handle: await handleOf(EDITOR), role: 'editor' })
    );

    expect(expectErr(await service.decline(STRANGER, token)).code).toBe(
      ErrorCodes.PLAYLIST_INVITE_INVALID
    );
    expectOk(await service.decline(EDITOR, token));
    expect(expectErr(await service.accept(EDITOR, token)).code).toBe(
      ErrorCodes.PLAYLIST_INVITE_INVALID
    );
  });

  it('drops a revoked link from the owner list and seats nobody through it', async () => {
    const { service } = await setUp();
    const link = expectOk(
      await service.createLink(OWNER, PLAYLIST, {
        role: 'contributor',
        expiresInDays: 30,
        maxUses: 5,
      })
    );

    expectOk(await service.revokeInvite(OWNER, PLAYLIST, link.id));

    expect(expectOk(await service.listInvites(OWNER, PLAYLIST)).items).toEqual([]);
    expect(expectErr(await service.accept(STRANGER, link.token)).code).toBe(
      ErrorCodes.PLAYLIST_INVITE_INVALID
    );
  });
});
