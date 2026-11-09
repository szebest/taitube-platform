import type {
  ChannelAuditPageView,
  ChannelInviteView,
  ChannelMemberView,
  ChannelMembershipView,
  MyInviteView,
} from '@vp/api-contracts';
import {
  acceptChannelInvite,
  changeChannelMemberRole,
  createChannelInvite,
  declineChannelInvite,
  getChannel,
  getChannelTeam,
  listChannelAudit,
  listMyInvites,
  listMyMemberships,
  removeChannelMember,
  revokeChannelInvite,
} from '@vp/api-contracts';
import type { ChannelRole } from '@vp/domain';
import { type ErrorCode, ErrorCodes } from '@vp/errors';
import { createActingChannelStore } from '@vp/queries';
import { channel, mockEndpoint, OWNER_ID, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

export const OTHER_CHANNEL_ID = '0190c3a0-5e1d-7000-8000-0000000cc002';
const OTHER_OWNER_ID = '0190c3a0-5e1d-7000-8000-0000000bb002';
export const EDITOR_ID = '0190c3a0-5e1d-7000-8000-0000000bb003';
export const MODERATOR_ID = '0190c3a0-5e1d-7000-8000-0000000bb004';
export const MANAGER_ID = '0190c3a0-5e1d-7000-8000-0000000bb005';
export const INVITE_ID = '0190c3a0-5e1d-7000-8000-0000000dd001';
const NEW_CHANNEL_ID = '0190c3a0-5e1d-7000-8000-0000000cc003';

const CREATED_AT = '2026-01-01T00:00:00.000Z';
const profile = (handle: string, displayName: string) => ({ handle, displayName, avatarUrl: null });

export function member(
  userId: string,
  role: ChannelRole,
  displayName: string,
  handle = displayName.toLowerCase()
): ChannelMemberView {
  return {
    userId,
    role,
    invitedBy: OWNER_ID,
    joinedAt: CREATED_AT,
    profile: profile(handle, displayName),
  };
}

export function invite(role: ChannelRole, displayName: string): ChannelInviteView {
  return {
    id: INVITE_ID,
    inviteeUserId: NEW_CHANNEL_ID,
    role,
    invitedBy: OWNER_ID,
    status: 'pending',
    createdAt: CREATED_AT,
    expiresAt: '2026-01-15T00:00:00.000Z',
    invitee: profile(displayName.toLowerCase(), displayName),
  };
}

export const MY_INVITE_ID = '0190c3a0-5e1d-7000-8000-0000000dd002';

export function myInvite(role: ChannelRole, overrides: Partial<MyInviteView> = {}): MyInviteView {
  return {
    id: MY_INVITE_ID,
    channel: { id: OTHER_CHANNEL_ID, ...profile('othershow', 'Other Show') },
    role,
    invitedByName: 'Olivia Owner',
    expiresAt: '2026-01-15T00:00:00.000Z',
    ...overrides,
  };
}

export const roleChanged = (id: string): ChannelAuditPageView['items'][number] => ({
  id,
  action: 'member.role_changed',
  targetType: 'member',
  targetId: EDITOR_ID,
  meta: { from: 'editor', to: 'manager' },
  actorUserId: OWNER_ID,
  actor: profile('creator', 'The Creator'),
  createdAt: CREATED_AT,
});

export const membership = (role: ChannelRole): ChannelMembershipView => ({
  channelId: OTHER_CHANNEL_ID,
  ownerId: OTHER_OWNER_ID,
  role,
  channel: profile('othershow', 'Other Show'),
});

export interface TeamState {
  members: ChannelMemberView[];
  invites: ChannelInviteView[];
  auditPages: ChannelAuditPageView['items'][];
  memberships: ChannelMembershipView[];
  myInvites: MyInviteView[];
}

interface TeamRequests {
  teamChannels: (string | null)[];
  changes: { userId: string; role: unknown }[];
  removed: string[];
  removedFrom: (string | null)[];
  revoked: string[];
  invited: { handle: string; role: string }[];
  accepted: string[];
  declined: string[];
  audits: { actor: string | null; action: string | null; cursor: string | null }[];
}

/** The API behind the team page: the state it answers from, and what it was asked, the state moving with each write. */
export function serveTeam(
  initial: Partial<TeamState> = {},
  inviteFailure?: ErrorCode,
  answerFailure?: ErrorCode
) {
  const state: TeamState = {
    members: [],
    invites: [],
    auditPages: [[]],
    memberships: [],
    myInvites: [],
    ...initial,
  };
  const requests: TeamRequests = {
    teamChannels: [],
    changes: [],
    removed: [],
    removedFrom: [],
    revoked: [],
    invited: [],
    accepted: [],
    declined: [],
    audits: [],
  };

  const handlers = [
    mockEndpoint(listMyMemberships, () => HttpResponse.json({ items: state.memberships })),
    mockEndpoint(getChannelTeam, ({ request }) => {
      requests.teamChannels.push(request.headers.get('x-channel-id'));
      return HttpResponse.json({ members: state.members, invites: state.invites });
    }),
    mockEndpoint(listChannelAudit, ({ request }) => {
      const { searchParams } = new URL(request.url);
      const cursor = searchParams.get('cursor');
      requests.audits.push({
        actor: searchParams.get('actorUserId'),
        action: searchParams.get('action'),
        cursor,
      });
      const index = cursor ? Number(cursor) : 0;
      return HttpResponse.json({
        items: state.auditPages[index] ?? [],
        nextCursor: index + 1 < state.auditPages.length ? String(index + 1) : null,
      });
    }),
    mockEndpoint(changeChannelMemberRole, async ({ request, params }) => {
      const { role } = (await request.json()) as { role: ChannelRole };
      requests.changes.push({ userId: String(params.userId), role });
      state.members = state.members.map((held) =>
        held.userId === params.userId ? { ...held, role } : held
      );
      return HttpResponse.json(
        state.members.find((held) => held.userId === params.userId) ?? state.members[0]
      );
    }),
    mockEndpoint(removeChannelMember, ({ request, params }) => {
      const channelId = request.headers.get('x-channel-id');
      requests.removed.push(String(params.userId));
      requests.removedFrom.push(channelId);
      state.members = state.members.filter((held) => held.userId !== params.userId);
      state.memberships = state.memberships.filter((held) => held.channelId !== channelId);
      return new HttpResponse(null, { status: 204 });
    }),
    mockEndpoint(revokeChannelInvite, ({ params }) => {
      requests.revoked.push(String(params.id));
      state.invites = state.invites.filter((pending) => pending.id !== params.id);
      return new HttpResponse(null, { status: 204 });
    }),
    mockEndpoint(createChannelInvite, async ({ request }) => {
      const body = (await request.json()) as { handle: string; role: ChannelRole };
      requests.invited.push(body);
      if (inviteFailure) return problemReply(inviteFailure);
      const created = invite(body.role, body.handle);
      state.invites = [...state.invites, created];
      return HttpResponse.json(created, { status: 201 });
    }),
    mockEndpoint(listMyInvites, () =>
      HttpResponse.json({ items: state.myInvites, nextCursor: null })
    ),
    mockEndpoint(acceptChannelInvite, ({ params }) => {
      requests.accepted.push(String(params.id));
      if (answerFailure) {
        state.myInvites = state.myInvites.filter((pending) => pending.id !== params.id);
        return problemReply(answerFailure);
      }
      const accepted = state.myInvites.find((pending) => pending.id === params.id);
      state.myInvites = state.myInvites.filter((pending) => pending.id !== params.id);
      if (!accepted) return problemReply(ErrorCodes.CHANNEL_INVITE_NOT_FOUND);
      const joined = {
        ...membership(accepted.role),
        channelId: accepted.channel.id,
        channel: accepted.channel,
      };
      state.memberships = [...state.memberships, joined];
      return HttpResponse.json(joined);
    }),
    mockEndpoint(declineChannelInvite, ({ params }) => {
      requests.declined.push(String(params.id));
      state.myInvites = state.myInvites.filter((pending) => pending.id !== params.id);
      return answerFailure ? problemReply(answerFailure) : new HttpResponse(null, { status: 204 });
    }),
    mockEndpoint(getChannel, ({ params }) =>
      params.idOrHandle === 'newcomer'
        ? HttpResponse.json(
            channel({ id: NEW_CHANNEL_ID, handle: 'newcomer', displayName: 'New Comer' })
          )
        : problemReply(ErrorCodes.CHANNEL_NOT_FOUND)
    ),
  ];

  return { state, requests, handlers };
}

/** The studio browser acting on `channelId`, as its cookie says. */
export function actOn(channelId: string) {
  createActingChannelStore().select(channelId);
}

/** A browser that has chosen no channel, for the next test. */
export function forgetActingChannel() {
  createActingChannelStore().select(undefined);
}
