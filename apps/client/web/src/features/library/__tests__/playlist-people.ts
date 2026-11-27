import {
  listPlaylistCollaborators,
  type PlaylistActivityView,
  type PlaylistCollaboratorView,
  type PlaylistInviteView,
} from '@vp/api-contracts';
import type { PlaylistCollaboratorRole } from '@vp/domain';
import { mockEndpoint, OWNER_ID } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { NOW, uuid } from '#app/__tests__/library-fixtures';

export const STRANGER_OWNER = uuid(9999);

/** The channel card of the person numbered `n`, named `name`. */
export function person(n: number, name: string) {
  return { id: uuid(7000 + n), handle: name.toLowerCase(), displayName: name, avatarUrl: null };
}

export function collaborator(
  n: number,
  name: string,
  overrides: Partial<PlaylistCollaboratorView> = {}
): PlaylistCollaboratorView {
  return {
    userId: uuid(8000 + n),
    role: 'editor',
    channel: person(n, name),
    joinedAt: NOW,
    ...overrides,
  };
}

/** The collaborators list answering `people`; with `seat`, the signed-in viewer sits among them in that role. */
export function seated(people: PlaylistCollaboratorView[], seat?: PlaylistCollaboratorRole) {
  const viewer = seat ? [collaborator(0, 'Me', { userId: OWNER_ID, role: seat })] : [];
  return mockEndpoint(listPlaylistCollaborators, () =>
    HttpResponse.json({ items: [...viewer, ...people] })
  );
}

export function invite(n: number, overrides: Partial<PlaylistInviteView> = {}): PlaylistInviteView {
  return {
    id: uuid(8500 + n),
    role: 'contributor',
    token: `token-${n}`,
    invitee: null,
    state: 'active',
    expiresAt: '2026-03-17T12:00:00.000Z',
    maxUses: null,
    useCount: 0,
    createdAt: NOW,
    ...overrides,
  };
}

/** One activity entry by `actor`, numbered `n`. */
export function activity<A extends PlaylistActivityView['action']>(
  n: number,
  action: A,
  target: Extract<PlaylistActivityView, { action: A }>['target'],
  actor: ReturnType<typeof person> | null = person(1, 'Ana')
): PlaylistActivityView {
  return {
    id: uuid(9100 + n),
    actorUserId: actor ? uuid(8001) : null,
    actor,
    createdAt: NOW,
    action,
    target,
  } as PlaylistActivityView;
}
