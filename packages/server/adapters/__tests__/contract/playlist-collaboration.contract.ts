import { err, ok } from '@kit/result';
import { expectErr, expectOk } from '@kit/testing/result';
import type { PlaylistInvite } from '@vp/domain';
import { NOTIFY_PLAYLIST_INVITE, NOTIFY_PLAYLIST_UPDATE } from '@vp/job-contracts';
import { OTHER_OWNER_ID, OWNER_ID, seedOwners } from './fixtures';
import { P } from './playlist-contract-context';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const NOW = new Date();
const LATER = new Date(NOW.getTime() + 86_400_000);
const INVITE = '00000000-0000-7000-8000-0000000005a1';
const LINK = '00000000-0000-7000-8000-0000000005a2';

function invite(overrides: Partial<PlaylistInvite> = {}): PlaylistInvite {
  return {
    id: INVITE,
    playlistId: P.mix,
    role: 'editor',
    token: 'p'.repeat(22),
    inviteeUserId: OTHER_OWNER_ID,
    createdBy: OWNER_ID,
    expiresAt: LATER,
    maxUses: 1,
    useCount: 0,
    revokedAt: null,
    createdAt: NOW,
    ...overrides,
  };
}

const LINK_INVITE = invite({ id: LINK, token: 'l'.repeat(22), inviteeUserId: null, maxUses: 2 });

export function describePlaylistCollaborationContract(makeSubject: MakeRepositoriesSubject): void {
  describe('PlaylistCollaboratorRepository and PlaylistActivityRepository contract', () => {
    let subject: RepositoriesSubject;

    const repos = () => subject.repositories;
    const seat = (token: string) =>
      repos().playlistCollaborators.accept(token, OTHER_OWNER_ID, ({ invite: found }) =>
        found ? ok({ playlistId: found.playlistId, role: found.role }) : err('missing' as const)
      );
    const queued = async () =>
      expectOk(await repos().outbox.claimBatch(50)).flatMap((row) =>
        row.kind === 'notification' && row.payload.type === 'queue'
          ? [{ name: row.payload.job.name, data: row.payload.job.data }]
          : []
      );
    const actions = async () =>
      expectOk(await repos().playlistActivity.list(P.mix, { cursor: null, limit: 50 })).map(
        (row) => row.action
      );

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(repos());
      expectOk(
        await repos().playlists.create({
          id: P.mix,
          ownerId: OWNER_ID,
          title: 'Mix',
          description: '',
          visibility: 'private',
        })
      );
    });

    it('sends a personal invite once, through the notify queue', async () => {
      expectOk(await repos().playlistCollaborators.createInvite(invite()));

      expect(await queued()).toContainEqual({
        name: NOTIFY_PLAYLIST_INVITE,
        data: { inviteId: INVITE },
      });
      expect(
        expectOk(await repos().playlistCollaborators.findInvite('p'.repeat(22)))
      ).toMatchObject({ id: INVITE, inviteeUserId: OTHER_OWNER_ID });
    });

    it('replaces an earlier invite to the same person', async () => {
      expectOk(await repos().playlistCollaborators.createInvite(invite()));
      const again = invite({ id: LINK, token: 'q'.repeat(22), role: 'contributor' });
      expectOk(await repos().playlistCollaborators.createInvite(again));

      const listed = expectOk(await repos().playlistCollaborators.listInvites(P.mix));
      expect(listed.map(({ id, role }) => [id, role])).toEqual([[LINK, 'contributor']]);
    });

    it('seats whoever takes a link, counts the use and logs it', async () => {
      expectOk(await repos().playlistCollaborators.createInvite(LINK_INVITE));

      expect(expectOk(await seat(LINK_INVITE.token))).toEqual({
        playlistId: P.mix,
        role: 'editor',
      });

      expect(expectOk(await repos().playlistCollaborators.list(P.mix))).toEqual([
        expect.objectContaining({ userId: OTHER_OWNER_ID, role: 'editor', addedBy: OWNER_ID }),
      ]);
      expect(
        expectOk(await repos().playlistCollaborators.findInvite(LINK_INVITE.token))
      ).toMatchObject({ useCount: 1 });
      expect(expectOk(await repos().playlistCollaborators.seats(P.mix, OTHER_OWNER_ID))).toEqual({
        seated: 1,
        isCollaborator: true,
      });
      expect(
        expectOk(await repos().playlists.findDetail(P.mix, { id: OTHER_OWNER_ID, role: 'USER' }))
          ?.viewer
      ).toEqual({ role: 'editor', following: false });
      expect(await actions()).toEqual(['collaborator_added']);
    });

    it('hands the plan the invite with its owner and the seats under the lock', async () => {
      expectOk(await repos().playlistCollaborators.createInvite(LINK_INVITE));

      const refused = await repos().playlistCollaborators.accept(
        LINK_INVITE.token,
        OTHER_OWNER_ID,
        (context) => err(context)
      );

      expect(expectErr(refused)).toEqual({
        invite: expect.objectContaining({ id: LINK, ownerId: OWNER_ID }),
        seated: 0,
        isCollaborator: false,
      });
      expect(expectOk(await repos().playlistCollaborators.list(P.mix))).toEqual([]);
    });

    it('hands the plan no invite for an unknown token', async () => {
      expect(expectErr(await seat('x'.repeat(22)))).toBe('missing');
    });

    it('tells the owner of a collaborator change, and the collaborator of the owner one', async () => {
      expectOk(await repos().playlistCollaborators.createInvite(LINK_INVITE));
      expectOk(await seat(LINK_INVITE.token));
      await queued();

      expect(
        expectOk(
          await repos().playlistCollaborators.changeRole(
            P.mix,
            OTHER_OWNER_ID,
            'contributor',
            OWNER_ID
          )
        )
      ).toBe(true);
      const told = expectOk(await repos().userEvents.listFrom(OTHER_OWNER_ID, 1, 50));
      expect(told.map((row) => row.type)).toContain('playlist.updated');
      expect(await actions()).toEqual(['role_changed', 'collaborator_added']);

      expect(
        expectOk(await repos().playlistCollaborators.remove(P.mix, OTHER_OWNER_ID, OTHER_OWNER_ID))
      ).toBe(true);
      expect(await queued()).toContainEqual({
        name: NOTIFY_PLAYLIST_UPDATE,
        data: expect.objectContaining({ playlistId: P.mix, actorUserId: OTHER_OWNER_ID }),
      });
      expect(
        expectOk(await repos().playlistCollaborators.remove(P.mix, OTHER_OWNER_ID, OWNER_ID))
      ).toBe(false);
    });

    it('revokes a link once and declines a personal invite by deleting it', async () => {
      expectOk(await repos().playlistCollaborators.createInvite(LINK_INVITE));
      expectOk(await repos().playlistCollaborators.createInvite(invite()));

      expect(expectOk(await repos().playlistCollaborators.revokeInvite(P.mix, LINK, NOW))).toBe(
        true
      );
      expect(expectOk(await repos().playlistCollaborators.revokeInvite(P.mix, LINK, NOW))).toBe(
        false
      );
      expect(expectOk(await repos().playlistCollaborators.deleteInvite(LINK_INVITE.token))).toBe(
        false
      );
      expect(expectOk(await repos().playlistCollaborators.deleteInvite('p'.repeat(22)))).toBe(true);
      expect(expectOk(await repos().playlistCollaborators.listInvites(P.mix))).toEqual([]);
      expect(expectOk(await repos().playlistCollaborators.findInviteById(LINK))).toMatchObject({
        revokedAt: NOW,
      });
    });

    it('walks the log newest first a page at a time, and purges what is past its age', async () => {
      for (const title of ['a', 'b', 'c']) {
        expectOk(await repos().playlists.update(P.mix, { title }, OWNER_ID));
      }

      const first = expectOk(
        await repos().playlistActivity.list(P.mix, { cursor: null, limit: 1 })
      );
      const last = first[0];
      const rest = expectOk(
        await repos().playlistActivity.list(P.mix, {
          cursor: last ? { createdAt: last.createdAt, id: last.id } : null,
          limit: 5,
        })
      );
      expect(first).toHaveLength(2);
      expect(rest).toHaveLength(2);
      expect(expectOk(await repos().playlistActivity.find(last?.id ?? ''))).toMatchObject({
        action: 'settings_changed',
        actorUserId: OWNER_ID,
        target: { fields: ['title'] },
      });

      expect(expectOk(await repos().playlistActivity.purgeOlderThan(NOW))).toBe(0);
      expect(expectOk(await repos().playlistActivity.purgeOlderThan(LATER))).toBe(3);
    });
  });
}
