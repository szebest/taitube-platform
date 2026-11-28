import { expectErr, expectOk } from '@kit/testing/result';
import type { ContentLinkParams } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { seedTeamMember } from '../../__tests__/test-app';
import {
  acting,
  CHANNEL_A,
  CHANNEL_B,
  CREATOR_A,
  CREATOR_B,
  linkHarness,
  VIEWER,
  video,
} from './content-link-harness';

const related: ContentLinkParams = { relation: 'related' };
const body = (
  source: ReturnType<typeof video>,
  target: ReturnType<typeof video>,
  params = related
) => ({
  source,
  target,
  params,
});

describe('apps/server/api/services: ContentLinkService', () => {
  let h: Awaited<ReturnType<typeof linkHarness>>;

  beforeEach(async () => {
    h = await linkHarness();
    for (let n = 1; n <= 22; n++) await h.seed(video('a', n), CREATOR_A, CHANNEL_A);
    for (let n = 1; n <= 3; n++) await h.seed(video('b', n), CREATOR_B, CHANNEL_B);
  });

  describe('create', () => {
    it('links a Short to its full video at 3:21, active at once and audited', async () => {
      const created = expectOk(
        await h.service.create(CREATOR_A, {
          ...body(video('a', 1), video('a', 2), { relation: 'full_video' }),
          anchors: {
            sourceStartMs: null,
            sourceEndMs: null,
            targetStartMs: 201_000,
            targetEndMs: null,
          },
        })
      );

      expect(created).toMatchObject({
        status: 'active',
        origin: 'creator',
        anchors: { targetStartMs: 201_000 },
      });
      const audit = expectOk(
        await h.repositories.channelAudit.list(CHANNEL_A, { cursor: null, limit: 10 })
      );
      expect(audit.map(({ action }) => action)).toContain('link.created');
    });

    it.each([
      {
        scenario: 'a relation that must stay in one channel, across channels',
        input: body(video('a', 1), video('b', 1), { relation: 'recap' }),
        code: ErrorCodes.LINK_RELATION_SAME_CHANNEL,
      },
      {
        scenario: 'a link to itself',
        input: body(video('a', 1), video('a', 1)),
        code: ErrorCodes.LINK_SELF,
      },
      {
        scenario: 'a bad anchor',
        input: {
          ...body(video('a', 1), video('a', 2)),
          anchors: {
            sourceStartMs: null,
            sourceEndMs: null,
            targetStartMs: 9_000_000,
            targetEndMs: null,
          },
        },
        code: ErrorCodes.LINK_ANCHOR_INVALID,
      },
    ])('refuses $scenario with $code', async ({ input, code }) => {
      expect(expectErr(await h.service.create(CREATOR_A, input)).code).toBe(code);
    });

    it('refuses a loop of previous links and a 21st outgoing link', async () => {
      expectOk(
        await h.service.create(
          CREATOR_A,
          body(video('a', 1), video('a', 2), { relation: 'previous' })
        )
      );
      const loop = await h.service.create(
        CREATOR_A,
        body(video('a', 2), video('a', 1), { relation: 'previous' })
      );
      const others = Array.from({ length: 22 }, (_, i) => i + 1).filter((n) => n !== 10);
      for (const n of others.slice(0, 20)) {
        expectOk(await h.service.create(CREATOR_A, body(video('a', 10), video('a', n))));
      }

      const twentyFirst = await h.service.create(
        CREATOR_A,
        body(video('a', 10), video('a', others[20] ?? 0))
      );

      expect(expectErr(loop).code).toBe(ErrorCodes.LINK_LOOP);
      expect(expectErr(twentyFirst).code).toBe(ErrorCodes.LINK_LIMIT);
    });

    it.each([
      { role: 'editor' as const, allowed: true },
      { role: 'moderator' as const, allowed: false },
    ])('lets a team $role link: $allowed', async ({ role, allowed }) => {
      const member: UserContext = {
        id: `00000000-0000-7000-8000-0000000d000${role.length}`,
        role: 'USER',
      };
      await h.repositories.users.upsert({ id: member.id, email: `${role}@example.test` });
      await seedTeamMember(h.repositories, { ownerId: CREATOR_A.id, memberId: member.id, role });
      const user: UserContext = {
        ...member,
        memberships: { [CHANNEL_A]: { role, ownerId: CREATOR_A.id } },
      };

      const result = await h.service.create(user, body(video('a', 1), video('a', 2)));

      if (allowed) expectOk(result);
      else expect(expectErr(result).code).toBe(ErrorCodes.FORBIDDEN);
    });
  });

  describe('across channels', () => {
    const response = body(video('a', 1), video('b', 1), { relation: 'response_to' });

    it('leaves a link pending under approve, tells the target, and activates it on approval', async () => {
      const created = expectOk(await h.service.create(CREATOR_A, response));

      expect(created.status).toBe('pending');
      expect((await h.notificationsOf(CREATOR_B)).map(({ kind }) => kind)).toEqual([
        'link_request',
      ]);
      expect(
        expectOk(await h.service.list(CREATOR_B, acting(CREATOR_B, CHANNEL_B), 'requests'))
      ).toHaveLength(1);

      const approved = expectOk(await h.service.approve(CREATOR_B, created.id));

      expect(approved).toMatchObject({ status: 'active', decidedBy: CREATOR_B.id });
      expect((await h.notificationsOf(CREATOR_A)).map(({ kind }) => kind)).toEqual([
        'link_decision',
      ]);
    });

    it.each([
      { policy: 'allow' as const, status: 'active', kind: 'link_added' },
      { policy: 'approve' as const, status: 'pending', kind: 'link_request' },
    ])(
      'under $policy the link is $status and the target owner gets $kind',
      async ({ policy, status, kind }) => {
        expectOk(await h.service.setPolicy(CREATOR_B, acting(CREATOR_B, CHANNEL_B), policy));

        const created = expectOk(await h.service.create(CREATOR_A, response));

        expect(created.status).toBe(status);
        expect((await h.notificationsOf(CREATOR_B)).map((n) => n.kind)).toEqual([kind]);
      }
    );

    it('refuses under block and a private target under any policy', async () => {
      expectOk(await h.service.setPolicy(CREATOR_B, acting(CREATOR_B, CHANNEL_B), 'block'));
      expect(expectErr(await h.service.create(CREATOR_A, response)).code).toBe(
        ErrorCodes.LINK_TARGET_BLOCKS
      );

      await h.seed(video('b', 4), CREATOR_B, CHANNEL_B, { visibility: 'private' });
      expectOk(await h.service.setPolicy(CREATOR_B, acting(CREATOR_B, CHANNEL_B), 'allow'));
      const refused = await h.service.create(
        CREATOR_A,
        body(video('a', 1), video('b', 4), { relation: 'response_to' })
      );
      expect(expectErr(refused).code).toBe(ErrorCodes.LINK_TARGET_NOT_PUBLIC);
    });

    it('lets the target owner remove an active inbound link and a stranger not', async () => {
      expectOk(await h.service.setPolicy(CREATOR_B, acting(CREATOR_B, CHANNEL_B), 'allow'));
      const created = expectOk(await h.service.create(CREATOR_A, response));

      expect(expectErr(await h.service.remove(VIEWER, created.id)).code).toBe(ErrorCodes.FORBIDDEN);
      expectOk(await h.service.remove(CREATOR_B, created.id));
      expect(expectErr(await h.service.remove(CREATOR_B, created.id)).code).toBe(
        ErrorCodes.CONTENT_LINK_NOT_FOUND
      );
    });
  });

  describe('suggest', () => {
    const suggestion = body(video('a', 1), video('a', 2));

    it('lands once in the source queue, whoever suggests it again', async () => {
      const other: UserContext = { id: '00000000-0000-7000-8000-0000000c0002', role: 'USER' };
      await h.repositories.users.upsert({ id: other.id, email: 'other@example.test' });

      expectOk(await h.service.suggest(VIEWER, suggestion));
      expectOk(await h.service.suggest(other, suggestion));

      const queue = expectOk(
        await h.service.list(CREATOR_A, acting(CREATOR_A, CHANNEL_A), 'suggestions')
      );
      expect(queue).toHaveLength(1);
      expect(expectErr(await h.service.suggest(VIEWER, suggestion)).code).toBe(
        ErrorCodes.LINK_EXISTS
      );
    });

    it('caps a viewer at 10 a day', async () => {
      for (let n = 3; n <= 12; n++)
        expectOk(await h.service.suggest(VIEWER, body(video('a', 1), video('a', n))));

      const eleventh = await h.service.suggest(VIEWER, body(video('a', 1), video('a', 13)));

      expect(expectErr(eleventh).code).toBe(ErrorCodes.LINK_SUGGESTION_LIMIT);
    });

    it.each([
      { kind: 'shadow' as const, stored: 0 },
      { kind: 'ban' as const, stored: 0 },
    ])('stores nothing for a $kind banned viewer', async ({ kind, stored }) => {
      expectOk(
        await h.repositories.channelUserRestrictions.apply({
          channelId: CHANNEL_A,
          userId: VIEWER.id,
          kind,
          reason: null,
          expiresAt: null,
          createdBy: CREATOR_A.id,
        })
      );

      const result = await h.service.suggest(VIEWER, suggestion);

      if (kind === 'shadow') expectOk(result);
      else expect(expectErr(result).code).toBe(ErrorCodes.COMMENTS_BANNED);
      expect(
        expectOk(await h.service.list(CREATOR_A, acting(CREATOR_A, CHANNEL_A), 'suggestions'))
      ).toHaveLength(stored);
    });

    it('becomes a creator link when accepted', async () => {
      expectOk(await h.service.suggest(VIEWER, suggestion));
      const [queued] = expectOk(
        await h.service.list(CREATOR_A, acting(CREATOR_A, CHANNEL_A), 'suggestions')
      );

      const accepted = expectOk(await h.service.accept(CREATOR_A, queued?.id ?? ''));

      expect(accepted).toMatchObject({
        status: 'active',
        origin: 'viewer',
        decidedBy: CREATOR_A.id,
      });
    });
  });
});
