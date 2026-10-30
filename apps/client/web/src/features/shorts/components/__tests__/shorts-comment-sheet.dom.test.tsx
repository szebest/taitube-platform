import { screen, within } from '@testing-library/react';
import { listVideoComments } from '@vp/api-contracts';
import { mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { renderShorts } from '#app/features/shorts/__tests__/render-shorts';
import { comment } from '#app/features/watch/__tests__/comment-fixtures';
import { RecordingObserver } from '#app/features/watch/__tests__/recording-observer';

vi.mock(import('#app/features/player'), async (importOriginal) => ({
  ...(await importOriginal()),
  TaitubePlayer: (await import('#app/features/shorts/__tests__/stub-short-player')).StubShortPlayer,
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apps/client/web: ShortsCommentSheet', () => {
  it('opens the discussion of the Short in a sheet, and closes it back to the player', async () => {
    RecordingObserver.install();
    const { user } = await renderShorts({
      handlers: [
        mockEndpoint(listVideoComments, () =>
          HttpResponse.json({ items: [comment()], nextCursor: null, total: 1 })
        ),
      ],
    });

    await user.click(screen.getByRole('button', { name: 'Discussion' }));
    RecordingObserver.enterView();

    const sheet = await screen.findByRole('dialog', { name: 'Discussion' });
    expect(await within(sheet).findByText('Ines Carvalho')).toBeInTheDocument();
    expect(within(sheet).getByRole('region', { name: /Discussion/ })).toHaveAttribute(
      'data-layout',
      'sheet'
    );

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
