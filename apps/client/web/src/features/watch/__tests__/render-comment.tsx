import { screen, within } from '@testing-library/react';
import {
  type Account,
  type ChannelMembershipView,
  type CommentView,
  listVideoComments,
} from '@vp/api-contracts';
import { mockEndpoint } from '@vp/web-testing';
import { type HttpHandler, HttpResponse } from 'msw/http';
import { comment } from '#app/__tests__/comment-fixtures';
import { renderDiscussion } from './render-discussion';

interface CommentOptions {
  viewer?: Account;
  memberships?: ChannelMembershipView[];
  handlers?: HttpHandler[];
  top?: Partial<CommentView>;
}

/** The watch page whose one comment is `top`, with that comment's article once it rendered. */
export async function renderComment({
  viewer,
  memberships,
  handlers = [],
  top = {},
}: CommentOptions = {}) {
  const thread = mockEndpoint(listVideoComments, () =>
    HttpResponse.json({ items: [comment(top)], nextCursor: null, total: 1 })
  );
  const rendered = await renderDiscussion({ viewer, memberships, handlers: [thread, ...handlers] });
  const article = (await screen.findByText('Ines Carvalho')).closest('article');
  if (!article) {
    throw new Error('the comment did not render');
  }

  return { ...rendered, article: within(article) };
}
