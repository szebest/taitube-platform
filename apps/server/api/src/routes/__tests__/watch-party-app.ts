import { createHash } from 'node:crypto';
import { Adapters } from '@vp/adapters/composition';
import { PARTY_CREDENTIAL_HEADER } from '@vp/api-contracts';
import type { PartyGuestSession } from '@vp/core/ports';
import type { WatchPartyInviteLink } from '@vp/domain';
import { MS_PER_HOUR } from '@vp/domain/time';
import type { AppConfigOverrides } from '@vp/env-schema';
import { SEEDED } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import type { LightMyRequestResponse } from 'fastify';
import { uuidv7 } from 'uuidv7';
import { bearer, buildTestApp, TOKENS } from '../../__tests__/test-app';
import { watchPartyTestConfig } from '../../services/watch-party/__tests__/watch-party-test-deps';

export const AS = {
  owner: bearer(TOKENS.user),
  other: bearer(TOKENS.otherUser),
  admin: bearer(TOKENS.admin),
  anonymous: {},
};

export type Who = keyof typeof AS;

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface Call {
  payload?: Record<string, unknown>;
  headers?: Record<string, string>;
}

export const QUICK_PARTY = { visibility: 'unlisted', preset: 'friends', hostAs: 'user' } as const;

/** The in-process app with watch parties on a cheap hash, and a caller of each kind. */
export async function buildWatchPartyApp(config: AppConfigOverrides = {}) {
  const test = await buildTestApp({ config: watchPartyTestConfig(config) });
  const { app, container } = test;

  const call = (who: Who, method: Method, url: string, { payload, headers }: Call = {}) =>
    app.inject({
      method,
      url,
      headers: { ...AS[who], ...headers },
      ...(payload ? { payload } : {}),
    });

  const createRoom = async (
    who: Who = 'owner',
    payload: Record<string, unknown> = {}
  ): Promise<{ id: string; version: number }> => {
    const created = await call(who, 'POST', '/v1/watch-parties', {
      payload: { ...QUICK_PARTY, ...payload },
    });
    expect(created.statusCode).toBe(201);
    return created.json();
  };

  let credentials = 0;
  /** A party credential issued straight through the port, as the header that carries it. */
  const credentialFor = async (session: PartyGuestSession) => {
    credentials += 1;
    const credential = `route-credential-${String(credentials).padStart(8, '0')}`;
    await container.get(Adapters.PartyGuestSessions).issue(credential, session, 3_600);
    return { [PARTY_CREDENTIAL_HEADER]: credential };
  };

  const presence = container.get(Adapters.WatchPartyPresence);

  /** An invite link row for a room, the token returned. */
  const seedLink = async (roomId: string, overrides: Partial<WatchPartyInviteLink> = {}) => {
    const token = `link-token-${uuidv7()}`;
    const at = new Date();
    expectOk(
      await test.repositories.watchPartyInviteLinks.create({
        id: uuidv7(),
        roomId,
        createdBy: `user:${SEEDED.userId}`,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(at.getTime() + MS_PER_HOUR),
        maxUses: null,
        uses: 0,
        revokedAt: null,
        createdAt: at,
        ...overrides,
      })
    );
    return token;
  };

  const ban = async (roomId: string, memberKey: string, ipHash: string | null = null) => {
    const at = new Date();
    expectOk(
      await test.repositories.watchPartyMembers.ban(
        {
          roomId,
          memberKey,
          ipHash,
          bannedBy: `user:${SEEDED.userId}`,
          reason: null,
          createdAt: at,
        },
        {
          id: uuidv7(),
          line: { event: 'banned', actorKey: null, targetKey: memberKey, detail: null },
          videoId: null,
          positionMs: null,
          createdAt: at,
        }
      )
    );
  };

  const crowd = async (roomId: string, count: number) => {
    for (let index = 0; index < count; index += 1) {
      expectOk(
        await presence.admit(roomId, `user:filler-${index}`, {
          limit: null,
          nowMs: Date.now(),
          staleBeforeMs: 0,
        })
      );
    }
  };

  return { ...test, call, createRoom, credentialFor, presence, seedLink, ban, crowd };
}

export type WatchPartyApp = Awaited<ReturnType<typeof buildWatchPartyApp>>;

export function problemOf(response: LightMyRequestResponse): { code: string; status: number } {
  return response.json();
}
