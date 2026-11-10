import { screen, within } from '@testing-library/react';
import { heldComment, renderQueue } from '#app/features/comments/__tests__/render-queue';

describe('apps/client/studio: /comments/queue', () => {
  it('opens the held comments, marks the review queue as the current page and loads only the held filter', async () => {
    await renderQueue({
      held: [heldComment({ content: 'Held for a link' })],
    });

    expect(await screen.findAllByText('Held for a link')).toHaveLength(2);
    const navigation = screen.getAllByRole('navigation', { name: 'Studio' })[0] as HTMLElement;
    expect(within(navigation).getByRole('link', { name: /Review queue/ })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });
});
