import { render, screen } from '@testing-library/react';
import { AppProviders } from '#app/__tests__/providers';
import { CommentItem } from '../../..';
import type { CommentState } from '../../../types';
import type { CommentItemModerationProps } from '../comment-item-moderation';

const renderModeration = (state: CommentState, props: CommentItemModerationProps = {}) =>
  render(
    <AppProviders>
      <CommentItem.Root state={state}>
        <CommentItem.Author name="Ines Carvalho" time="now" dateTime="2026-10-14T09:12:00Z" />
        <CommentItem.Moderation {...props} />
        <CommentItem.Body>The tram at 02:15 is the best sound design this year.</CommentItem.Body>
        <CommentItem.Actions>
          <CommentItem.Reply />
        </CommentItem.Actions>
      </CommentItem.Root>
    </AppProviders>
  );

describe('apps/client/web: CommentItemModeration', () => {
  it.each([
    { state: 'held', badge: 'Waiting for review' },
    { state: 'hidden', badge: 'Hidden by moderators' },
  ] as const)(
    'badges the $state state and keeps the text and actions for whoever may use them',
    ({ state, badge }) => {
      renderModeration(state);

      expect(screen.getByText(badge)).toBeInTheDocument();
      expect(screen.getByText(/best sound design/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reply' })).toBeInTheDocument();
    }
  );

  it.each([
    { props: { reason: 'Spam' }, shown: ['Spam'], absent: ['Silent'] },
    { props: { silent: true }, shown: ['Silent'], absent: ['Spam'] },
    { props: { reason: 'Spam', silent: true }, shown: ['Spam', 'Silent'], absent: [] },
  ])('draws $shown on a held comment', ({ props, shown, absent }) => {
    renderModeration('held', props);

    for (const text of shown) expect(screen.getByText(text)).toBeInTheDocument();
    for (const text of absent) expect(screen.queryByText(text)).not.toBeInTheDocument();
  });

  it.each(['view', 'deleted', 'removed'] as const)('draws nothing in the %s state', (state) => {
    renderModeration(state, { reason: 'Spam', silent: true });

    expect(screen.queryByText('Spam')).not.toBeInTheDocument();
    expect(screen.queryByText('Silent')).not.toBeInTheDocument();
    expect(screen.queryByText('Waiting for review')).not.toBeInTheDocument();
  });
});
