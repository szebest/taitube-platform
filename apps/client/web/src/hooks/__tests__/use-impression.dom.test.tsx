import { render } from '@testing-library/react';
import type { VideoSummary } from '@vp/api-contracts';
import { VIDEO_ID } from '@vp/web-testing';
import { RecordingObserver } from '#app/__tests__/recording-observer';
import { useRecordImpression } from '#app/integrations/impressions/impressions-provider';
import { useImpression } from '../use-impression';

vi.mock(import('#app/integrations/impressions/impressions-provider'), async (importOriginal) => ({
  ...(await importOriginal()),
  useRecordImpression: vi.fn(),
}));

const EXPERIMENT = { id: '0190c3a0-5e1d-7000-8000-0000000000e2', variantId: 'b' as const };

function Card({ video }: { video: Pick<VideoSummary, 'id' | 'experiment'> }) {
  return <article ref={useImpression(video)} />;
}

function renderCard(video: Pick<VideoSummary, 'id' | 'experiment'>) {
  const record = vi.fn();
  vi.mocked(useRecordImpression).mockReturnValue(record);
  render(<Card video={video} />);
  return record;
}

describe('apps/client/web: useImpression', () => {
  beforeEach(() => RecordingObserver.install());

  it('counts the variant a card shows when it comes into view', () => {
    const record = renderCard({ id: VIDEO_ID, experiment: EXPERIMENT });
    expect(record).not.toHaveBeenCalled();

    RecordingObserver.enterView();

    expect(record).toHaveBeenCalledExactlyOnceWith({
      videoId: VIDEO_ID,
      experimentId: EXPERIMENT.id,
      variantId: 'b',
    });
  });

  it('watches nothing for a card in no test', () => {
    renderCard({ id: VIDEO_ID });

    expect(RecordingObserver.all).toEqual([]);
  });
});
