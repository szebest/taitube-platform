import type { FakeStore } from './fake-api-store';
import { type FakeComment, type Route, problem } from './fake-api-types';

export function socialRoutes(store: FakeStore): Route[] {
  const { comments, reports, reactions, subscriptions, id, roots, commentPage } = store;
  return [
    [
      'GET',
      '/v1/videos/:id/comments',
      ({ params }) => ({ body: commentPage(roots(params.id ?? '')) }),
    ],
    [
      'POST',
      '/v1/videos/:id/comments',
      ({ actor, params, json }) => {
        const parent = comments.find((c) => c.id === json.parentId);
        const comment: FakeComment = {
          id: id('comment'),
          videoId: params.id ?? '',
          parentId: parent?.id ?? null,
          content: json.content ?? '',
          isPinned: false,
          heartedByCreator: false,
          replyCount: 0,
          author: { userId: actor?.id ?? '' },
        };
        comments.push(comment);
        if (parent) parent.replyCount += 1;
        return { status: 201, body: comment };
      },
    ],
    [
      'GET',
      '/v1/comments/:id/replies',
      ({ params }) => ({ body: commentPage(comments.filter((c) => c.parentId === params.id)) }),
    ],
    [
      'POST',
      '/v1/comments/:id/pin',
      ({ params }) => {
        const comment = comments.find((c) => c.id === params.id);
        if (comment) comment.isPinned = true;
        return { body: comment };
      },
    ],
    [
      'POST',
      '/v1/comments/:id/heart',
      ({ params }) => {
        const comment = comments.find((c) => c.id === params.id);
        if (comment) comment.heartedByCreator = true;
        return { body: comment };
      },
    ],
    [
      'POST',
      '/v1/comments/:id/reports',
      ({ actor, params }) => {
        const key = `${actor?.id}:${params.id}`;
        if (reports.has(key)) return problem(409, 'COMMENT_ALREADY_REPORTED');
        reports.add(key);
        return { status: 201, body: {} };
      },
    ],
    [
      'GET',
      '/v1/videos/:id/reactions/me',
      ({ actor, params }) => ({
        body: { reaction: reactions.get(`${actor?.id}:${params.id}`) ?? null },
      }),
    ],
    [
      'PUT',
      '/v1/videos/:id/reactions',
      ({ actor, params, json }) => {
        reactions.set(`${actor?.id}:${params.id}`, json.type ?? '');
        return { body: {} };
      },
    ],
    [
      'GET',
      '/v1/channels/:id/subscribers/me',
      ({ actor, params }) => ({
        body: { subscribed: subscriptions.has(`${actor?.id}:${params.id}`) },
      }),
    ],
    [
      'POST',
      '/v1/channels/:id/subscribers',
      ({ actor, params }) => {
        subscriptions.add(`${actor?.id}:${params.id}`);
        return { status: 201, body: {} };
      },
    ],
  ];
}
