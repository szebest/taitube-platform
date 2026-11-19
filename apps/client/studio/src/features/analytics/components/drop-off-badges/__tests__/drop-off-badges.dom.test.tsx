import { screen } from '@testing-library/react';
import { getVideo, getVideoRetention } from '@vp/api-contracts';
import { apiServer, mockEndpoint, VIDEO_ID, video } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { serveAnalytics } from '#app/features/analytics/__tests__/analytics-api.fixture';
import { renderAnalytics } from '#app/features/analytics/__tests__/render-analytics';
import { DropOffBadges } from '../drop-off-badges';

const renderBadges = () => renderAnalytics(<DropOffBadges videoId={VIDEO_ID} />);

function serveCounted(viewers: number[], durationMs: number | undefined) {
  const answered = vi.fn();
  apiServer.use(
    mockEndpoint(getVideoRetention, () => {
      answered();
      return HttpResponse.json({
        videoId: VIDEO_ID,
        curve: viewers.map((count, index) => ({ percent: index * 5, viewers: count })),
      });
    }),
    mockEndpoint(getVideo, () => {
      answered();
      return HttpResponse.json(video({ durationMs }));
    })
  );
  return answered;
}

describe('apps/client/studio: DropOffBadges', () => {
  it('names the time and the share of the viewers who leave at the biggest drops, largest first', async () => {
    serveAnalytics({ retention: [100, 90, 60, 50, 45], durationMs: 200_000 });
    await renderBadges();

    const badges = await screen.findAllByRole('listitem');

    expect(badges.map((badge) => badge.textContent)).toEqual([
      '00:10, 30% leave here',
      '00:20, 10% leave here',
      '00:30, 5% leave here',
    ]);
  });

  it.each([
    { scenario: 'a curve nobody has played', viewers: [0, 0, 0], durationMs: 100_000 },
    { scenario: 'a video with no known length', viewers: [100, 80, 40], durationMs: undefined },
  ])('shows nothing for $scenario', async ({ viewers, durationMs }) => {
    const answered = serveCounted(viewers, durationMs);
    await renderBadges();

    await vi.waitFor(() => expect(answered).toHaveBeenCalledTimes(2));

    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });
});
