import { InMemoryCacheClient, InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters';
import { mintToken } from '@vp/dev-token';
import { ErrorCodes } from '@vp/errors';
import { type Action, type UserContext, can, normalizeRole, parseRole } from '@vp/permissions';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app';

describe('Ticket 39: Declarative RBAC & ABAC permission engine', () => {
  describe('Domain Permission Evaluator: can(user, action, resource)', () => {
    const guestUser: UserContext | null = null;
    const standardUser: UserContext = { id: 'user-1', role: 'USER' };
    const creatorUser: UserContext = { id: 'creator-1', role: 'CREATOR' };
    const moderatorUser: UserContext = { id: 'mod-1', role: 'MODERATOR' };
    const adminUser: UserContext = { id: 'admin-1', role: 'ADMIN' };

    describe('Role normalization', () => {
      it('normalizes role strings and falls back to GUEST', () => {
        expect(normalizeRole(null)).toBe('GUEST');
        expect(normalizeRole(undefined)).toBe('GUEST');
        expect(normalizeRole('')).toBe('GUEST');
        expect(normalizeRole('unknown')).toBe('GUEST');
        expect(normalizeRole('user')).toBe('USER');
        expect(normalizeRole('USER')).toBe('USER');
        expect(normalizeRole('creator')).toBe('CREATOR');
        expect(normalizeRole('CREATOR')).toBe('CREATOR');
        expect(normalizeRole('moderator')).toBe('MODERATOR');
        expect(normalizeRole('MODERATOR')).toBe('MODERATOR');
        expect(normalizeRole('admin')).toBe('ADMIN');
        expect(normalizeRole('ADMIN')).toBe('ADMIN');
      });
    });

    describe('Guest permissions', () => {
      it('allows video:read for public or unlisted videos', () => {
        expect(can(guestUser, 'video:read')).toBe(true);
        expect(can(guestUser, 'video:read', { visibility: 'public' })).toBe(true);
        expect(can(guestUser, 'video:read', { visibility: 'unlisted' })).toBe(true);
      });

      it('forbids video:read for private videos', () => {
        expect(can(guestUser, 'video:read', { visibility: 'private', ownerId: 'user-1' })).toBe(
          false
        );
      });

      it('forbids video:create, video:update, video:delete, video:publish', () => {
        expect(can(guestUser, 'video:create')).toBe(false);
        expect(can(guestUser, 'video:update', { ownerId: 'user-1' })).toBe(false);
        expect(can(guestUser, 'video:delete', { ownerId: 'user-1' })).toBe(false);
        expect(can(guestUser, 'video:publish', { ownerId: 'user-1' })).toBe(false);
      });

      it('forbids comment and channel actions', () => {
        expect(can(guestUser, 'comment:create')).toBe(false);
        expect(can(guestUser, 'comment:delete', { authorId: 'user-1' })).toBe(false);
        expect(can(guestUser, 'comment:pin', { videoOwnerId: 'user-1' })).toBe(false);
        expect(can(guestUser, 'channel:update', { userId: 'user-1' })).toBe(false);
        expect(can(guestUser, 'channel:manage', { userId: 'user-1' })).toBe(false);
      });

      it('forbids admin actions', () => {
        expect(can(guestUser, 'category:manage')).toBe(false);
        expect(can(guestUser, 'analytics:view_all')).toBe(false);
      });
    });

    describe('User permissions', () => {
      it('allows video:create and comment:create', () => {
        expect(can(standardUser, 'video:create')).toBe(true);
        expect(can(standardUser, 'comment:create')).toBe(true);
      });

      it('allows reading public, unlisted, or own private video', () => {
        expect(can(standardUser, 'video:read', { visibility: 'public', ownerId: 'user-2' })).toBe(
          true
        );
        expect(can(standardUser, 'video:read', { visibility: 'unlisted', ownerId: 'user-2' })).toBe(
          true
        );
        expect(can(standardUser, 'video:read', { visibility: 'private', ownerId: 'user-1' })).toBe(
          true
        );
      });

      it('forbids reading foreign private video', () => {
        expect(can(standardUser, 'video:read', { visibility: 'private', ownerId: 'user-2' })).toBe(
          false
        );
      });

      it('allows editing and deleting own video, forbids on foreign videos', () => {
        expect(can(standardUser, 'video:update', { ownerId: 'user-1' })).toBe(true);
        expect(can(standardUser, 'video:delete', { ownerId: 'user-1' })).toBe(true);

        expect(can(standardUser, 'video:update', { ownerId: 'user-2' })).toBe(false);
        expect(can(standardUser, 'video:delete', { ownerId: 'user-2' })).toBe(false);
        expect(can(standardUser, 'video:update')).toBe(false);
        expect(can(standardUser, 'video:delete')).toBe(false);
      });

      it('forbids video:publish for standard users', () => {
        expect(can(standardUser, 'video:publish', { ownerId: 'user-1' })).toBe(false);
      });

      it('allows deleting own comment, forbids foreign comments on foreign videos', () => {
        expect(
          can(standardUser, 'comment:delete', { authorId: 'user-1', videoOwnerId: 'user-2' })
        ).toBe(true);
        expect(
          can(standardUser, 'comment:delete', { authorId: 'user-2', videoOwnerId: 'user-3' })
        ).toBe(false);
      });

      it('allows deleting foreign comments under own video (video owner moderation)', () => {
        expect(
          can(standardUser, 'comment:delete', { authorId: 'user-2', videoOwnerId: 'user-1' })
        ).toBe(true);
      });

      it('allows pinning comments only if user is video owner', () => {
        expect(can(standardUser, 'comment:pin', { videoOwnerId: 'user-1' })).toBe(true);
        expect(can(standardUser, 'comment:pin', { videoOwnerId: 'user-2' })).toBe(false);
        expect(can(standardUser, 'comment:pin')).toBe(false);
      });

      it('allows updating own channel, forbids managing channel or updating foreign channel', () => {
        expect(can(standardUser, 'channel:update', { userId: 'user-1' })).toBe(true);
        expect(can(standardUser, 'channel:update', { userId: 'user-2' })).toBe(false);
        expect(can(standardUser, 'channel:manage', { userId: 'user-1' })).toBe(false);
      });

      it('forbids category:manage and analytics:view_all', () => {
        expect(can(standardUser, 'category:manage')).toBe(false);
        expect(can(standardUser, 'analytics:view_all')).toBe(false);
      });
    });

    describe('Creator permissions', () => {
      it('allows video:publish for own videos, forbids for foreign videos', () => {
        expect(can(creatorUser, 'video:publish', { ownerId: 'creator-1' })).toBe(true);
        expect(can(creatorUser, 'video:publish', { ownerId: 'user-2' })).toBe(false);
      });

      it('allows channel:manage for own channel, forbids for foreign channel', () => {
        expect(can(creatorUser, 'channel:manage', { userId: 'creator-1' })).toBe(true);
        expect(can(creatorUser, 'channel:manage', { userId: 'user-2' })).toBe(false);
      });

      it('can pin comments under own video, cannot pin on foreign video', () => {
        expect(can(creatorUser, 'comment:pin', { videoOwnerId: 'creator-1' })).toBe(true);
        expect(can(creatorUser, 'comment:pin', { videoOwnerId: 'user-2' })).toBe(false);
      });

      it('can delete comments under own video', () => {
        expect(
          can(creatorUser, 'comment:delete', {
            authorId: 'user-2',
            videoOwnerId: 'creator-1',
          })
        ).toBe(true);
      });
    });

    describe('Moderator permissions', () => {
      it('allows deleting comments anywhere across the platform', () => {
        expect(
          can(moderatorUser, 'comment:delete', {
            authorId: 'user-2',
            videoOwnerId: 'user-3',
          })
        ).toBe(true);
      });

      it('allows reading private videos for moderation', () => {
        expect(
          can(moderatorUser, 'video:read', {
            visibility: 'private',
            ownerId: 'user-2',
          })
        ).toBe(true);
      });

      it('forbids admin actions', () => {
        expect(can(moderatorUser, 'category:manage')).toBe(false);
        expect(can(moderatorUser, 'analytics:view_all')).toBe(false);
      });
    });

    describe('Admin permissions (superuser bypass)', () => {
      const allActions: Action[] = [
        'video:read',
        'video:create',
        'video:update',
        'video:delete',
        'video:publish',
        'comment:create',
        'comment:delete',
        'comment:pin',
        'channel:update',
        'channel:manage',
        'category:manage',
        'analytics:view_all',
      ];

      it('bypasses checks and allows every action unconditionally', () => {
        for (const action of allActions) {
          expect(can(adminUser, action)).toBe(true);
          expect(can(adminUser, action, { ownerId: 'foreign-id', userId: 'foreign-id' })).toBe(
            true
          );
        }
      });

      it('works with lowercase role string parsed via parseRole (admin)', () => {
        const lowerAdmin: UserContext = { id: 'admin-lower', role: parseRole('admin') };
        for (const action of allActions) {
          expect(can(lowerAdmin, action)).toBe(true);
        }
      });
    });
  });

  describe('Fastify Authorization Helper: server.authorize() & request.authorize()', () => {
    let app: FastifyInstance;
    let repositories: InMemoryRepositories;

    const USER_A_ID = '00000000-0000-7000-8000-000000000010';
    const USER_B_ID = '00000000-0000-7000-8000-000000000020';
    const ADMIN_ID = '00000000-0000-7000-8000-000000000030';

    let userAToken: string;
    let userBToken: string;
    let adminToken: string;

    beforeAll(async () => {
      userAToken = mintToken({ sub: USER_A_ID, role: 'user', ttl: '1h' });
      userBToken = mintToken({ sub: USER_B_ID, role: 'user', ttl: '1h' });
      adminToken = mintToken({ sub: ADMIN_ID, role: 'admin', ttl: '1h' });

      repositories = new InMemoryRepositories();
      const cache = new InMemoryCacheClient();
      const storage = new InMemoryStorageClient();

      app = await buildApp({
        repositories,
        cache,
        storage,
      });

      // Register test routes exercising server.authorize decorator
      app.get(
        '/test/resource/:ownerId',
        {
          preHandler: [
            app.authorize('video:update', (req) => ({
              ownerId: (req.params as { ownerId: string }).ownerId,
            })),
          ],
        },
        async (_req, reply) => {
          return reply.status(200).send({ ok: true, message: 'Resource updated' });
        }
      );

      // Register test route exercising request.authorize()
      app.delete('/test/comment/:authorId', async (req, reply) => {
        const { authorId } = req.params as { authorId: string };
        await req.authorize('comment:delete', { authorId });
        return reply.status(200).send({ ok: true, message: 'Comment deleted' });
      });
    });

    afterAll(async () => {
      await app.close();
    });

    it('returns 401 UNAUTHORIZED with RFC 9457 Problem Details when anonymous', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/test/resource/${USER_A_ID}`,
      });

      expect(res.statusCode).toBe(401);
      expect(res.headers['content-type']).toContain('application/problem+json');
      const body = JSON.parse(res.body);
      expect(body.code).toBe(ErrorCodes.UNAUTHORIZED);
      expect(body.status).toBe(401);
    });

    it('returns 403 FORBIDDEN with RFC 9457 Problem Details when authenticated but unauthorized', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/test/resource/${USER_B_ID}`,
        headers: {
          authorization: `Bearer ${userAToken}`,
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.headers['content-type']).toContain('application/problem+json');
      const body = JSON.parse(res.body);
      expect(body.code).toBe(ErrorCodes.FORBIDDEN);
      expect(body.status).toBe(403);
      expect(body.detail).toContain('Forbidden');
    });

    it('returns 200 OK when authorized as resource owner', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/test/resource/${USER_A_ID}`,
        headers: {
          authorization: `Bearer ${userAToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.ok).toBe(true);
      expect(body.message).toBe('Resource updated');
    });

    it('returns 200 OK for Admin superuser on foreign resource', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/test/resource/${USER_A_ID}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.ok).toBe(true);
    });

    it('returns 200 OK when user B accesses own resource', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/test/resource/${USER_B_ID}`,
        headers: {
          authorization: `Bearer ${userBToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.ok).toBe(true);
    });

    it('request.authorize() rejects unauthorized delete with 403 problem+json', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/test/comment/${USER_B_ID}`,
        headers: {
          authorization: `Bearer ${userAToken}`,
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.headers['content-type']).toContain('application/problem+json');
      const body = JSON.parse(res.body);
      expect(body.code).toBe(ErrorCodes.FORBIDDEN);
    });

    it('request.authorize() allows author delete with 200 OK', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/test/comment/${USER_A_ID}`,
        headers: {
          authorization: `Bearer ${userAToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.ok).toBe(true);
    });
  });
});
