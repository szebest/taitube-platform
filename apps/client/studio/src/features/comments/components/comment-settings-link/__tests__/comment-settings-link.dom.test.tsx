import { screen } from '@testing-library/react';
import { renderInbox } from '#app/features/comments/__tests__/render-inbox';

describe('apps/client/studio: CommentSettingsLink', () => {
  it('leads the people who change the settings from the inbox to them', async () => {
    await renderInbox('/comments');

    expect(screen.getByRole('link', { name: 'Comment settings' })).toHaveAttribute(
      'href',
      '/comments/settings'
    );
  });
});
