import {
  type ShareLinkView,
  type Video,
  clearVideoPassword,
  createVideoShareLink,
  listVideoShareLinks,
  revokeVideoShareLink,
  setVideoPassword,
} from '@vp/api-contracts';
import { type ErrorCode, ErrorCodes } from '@vp/errors';
import { apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { serveEditor } from './edit-api.fixture';

const linkId = (n: number) => `0190c3a0-5e1d-7000-8000-00000000f0${String(n).padStart(2, '0')}`;

export function shareLink(patch: Partial<ShareLinkView> = {}): ShareLinkView {
  return {
    id: linkId(1),
    token: 'abcdefghijklmnopqrstuv',
    label: 'Press preview',
    expiresAt: null,
    revokedAt: null,
    createdAt: '2026-03-01T12:00:00.000Z',
    state: 'active',
    stats: { opens: 12, views: 30, watchSeconds: 3725 },
    ...patch,
  };
}

interface SharingOptions {
  links?: ShareLinkView[];
  /** The code the create and the password PUT answer with instead of succeeding. */
  refuseWith?: ErrorCode;
  revokeFails?: boolean;
}

/**
 * The editor's API plus the Sharing tab: the share links and the password, each answering from
 * state the test can read back.
 */
export function serveSharing(
  initial: Video,
  { links = [shareLink()], refuseWith, revokeFails = false }: SharingOptions = {}
) {
  const editor = serveEditor(initial);
  const state = {
    links,
    created: [] as unknown[],
    revoked: [] as string[],
    passwords: [] as unknown[],
    cleared: 0,
  };

  apiServer.use(
    mockEndpoint(listVideoShareLinks, () => HttpResponse.json({ items: state.links })),
    mockEndpoint(createVideoShareLink, async ({ request }) => {
      const body = (await request.json()) as { label?: string; expiresIn: string };
      state.created.push(body);
      if (refuseWith) return problemReply(refuseWith);
      const created = shareLink({
        id: linkId(state.links.length + 2),
        token: 'zyxwvutsrqponmlkjihgfe',
        label: body.label ?? null,
        stats: { opens: 0, views: 0, watchSeconds: 0 },
      });
      state.links = [created, ...state.links];
      return HttpResponse.json(created, { status: 201 });
    }),
    mockEndpoint(revokeVideoShareLink, ({ params }) => {
      const id = String(params['linkId']);
      state.revoked.push(id);
      if (revokeFails) return problemReply(ErrorCodes.INTERNAL);
      state.links = state.links.map((link) =>
        link.id === id ? { ...link, state: 'revoked', revokedAt: '2026-03-02T12:00:00.000Z' } : link
      );
      return new HttpResponse(null, { status: 204 });
    }),
    mockEndpoint(setVideoPassword, async ({ request }) => {
      state.passwords.push(await request.json());
      if (refuseWith) return problemReply(refuseWith);
      editor.api.stored = { ...editor.api.stored, passwordProtected: true };
      return HttpResponse.json({ passwordProtected: true });
    }),
    mockEndpoint(clearVideoPassword, () => {
      state.cleared += 1;
      editor.api.stored = { ...editor.api.stored, passwordProtected: false };
      return new HttpResponse(null, { status: 204 });
    })
  );
  return { ...editor, state };
}
