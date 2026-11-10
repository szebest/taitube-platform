import { screen } from '@testing-library/react';
import {
  type CommentSettingsView,
  createSavedReply,
  deleteSavedReply,
  getCommentSettings,
  liftRestriction,
  listRestrictions,
  listSavedReplies,
  listTrustedCommenters,
  type RestrictionView,
  type SavedReplyView,
  type TrustedCommenterView,
  untrustCommenter,
  updateCommentSettings,
  updateSavedReply,
} from '@vp/api-contracts';
import { DEFAULT_DISCLOSURE } from '@vp/domain';
import { mockEndpoint } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

export const SETTINGS: CommentSettingsView = {
  reviewMode: 'none',
  blockedWords: ['spoiler'],
  linkAllowlist: ['example.com'],
  slowModeSeconds: null,
  subscribersOnly: false,
  minAccountAgeDays: 0,
  disclosure: DEFAULT_DISCLOSURE,
};

export interface SettingsState {
  settings: CommentSettingsView;
  trusted: TrustedCommenterView[];
  restrictions: RestrictionView[];
  replies: SavedReplyView[];
}

/** /comments/settings over an API that keeps `state` and records what was sent: every save, lift and untrust. */
export async function renderSettings(initial: Partial<SettingsState> = {}) {
  const state: SettingsState = {
    settings: SETTINGS,
    trusted: [],
    restrictions: [],
    replies: [],
    ...initial,
  };
  const sent = {
    saves: [] as CommentSettingsView[],
    lifted: [] as string[],
    untrusted: [] as string[],
    replies: [] as { method: string; body: unknown }[],
  };
  const rendered = await renderRoute(getRouter, '/comments/settings', {
    handlers: [
      signInBrowser(),
      mockEndpoint(getCommentSettings, () => HttpResponse.json(state.settings)),
      mockEndpoint(updateCommentSettings, async ({ request }) => {
        state.settings = (await request.json()) as CommentSettingsView;
        sent.saves.push(state.settings);
        return HttpResponse.json(state.settings);
      }),
      mockEndpoint(listTrustedCommenters, () =>
        HttpResponse.json({ items: state.trusted, nextCursor: null })
      ),
      mockEndpoint(untrustCommenter, ({ params }) => {
        sent.untrusted.push(String(params.userId));
        state.trusted = state.trusted.filter(({ userId }) => userId !== params.userId);
        return new HttpResponse(null, { status: 204 });
      }),
      mockEndpoint(listRestrictions, () =>
        HttpResponse.json({ items: state.restrictions, nextCursor: null })
      ),
      mockEndpoint(liftRestriction, ({ params }) => {
        sent.lifted.push(String(params.userId));
        state.restrictions = state.restrictions.filter(({ userId }) => userId !== params.userId);
        return new HttpResponse(null, { status: 204 });
      }),
      mockEndpoint(listSavedReplies, () => HttpResponse.json({ items: state.replies })),
      mockEndpoint(createSavedReply, async ({ request }) => {
        const body = (await request.json()) as { title: string; body: string };
        sent.replies.push({ method: 'POST', body });
        const created = {
          id: `0190c3a0-5e1d-7000-8000-00000000a1${state.replies.length}`,
          position: state.replies.length,
          ...body,
        };
        state.replies = [...state.replies, created];
        return HttpResponse.json(created, { status: 201 });
      }),
      mockEndpoint(updateSavedReply, async ({ request, params }) => {
        const body = (await request.json()) as Partial<SavedReplyView>;
        sent.replies.push({ method: 'PATCH', body });
        state.replies = state.replies.map((reply) =>
          reply.id === params.id ? { ...reply, ...body } : reply
        );
        return HttpResponse.json(
          state.replies.find(({ id }) => id === params.id) as SavedReplyView
        );
      }),
      mockEndpoint(deleteSavedReply, ({ params }) => {
        sent.replies.push({ method: 'DELETE', body: params.id });
        state.replies = state.replies.filter(({ id }) => id !== params.id);
        return new HttpResponse(null, { status: 204 });
      }),
    ],
  });
  await screen.findByRole('heading', { level: 1, name: 'Comment settings' });
  return { ...rendered, state, sent };
}

export const sectionOf = (name: string) => screen.getByRole('form', { name });
