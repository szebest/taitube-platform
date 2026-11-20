import { type ImpressionBatch, MAX_IMPRESSIONS_PER_BATCH } from '@vp/api-contracts';
import { createImpressionQueue, type Impression } from '../impression-queue';

const EXPERIMENT_ID = '0190c3a0-5e1d-7000-8000-0000000000e2';

const impression = (index: number, variantId: Impression['variantId'] = 'a'): Impression => ({
  videoId: `0190c3a0-5e1d-7000-8000-${String(index).padStart(12, '0')}`,
  experimentId: EXPERIMENT_ID,
  variantId,
});

function queue() {
  const sent: ImpressionBatch[] = [];
  return { sent, queue: createImpressionQueue((batch) => sent.push(batch)) };
}

describe('apps/client/web: createImpressionQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends what came into view in one batch five seconds after the first', () => {
    const { sent, queue: impressions } = queue();

    impressions.record(impression(1));
    vi.advanceTimersByTime(4000);
    impressions.record(impression(2));
    expect(sent).toEqual([]);
    vi.advanceTimersByTime(1000);

    expect(sent).toEqual([{ items: [impression(1), impression(2)] }]);
  });

  it('sends a batch at once when it is as full as the API takes, and starts the next', () => {
    const { sent, queue: impressions } = queue();

    for (let index = 0; index <= MAX_IMPRESSIONS_PER_BATCH; index += 1) {
      impressions.record(impression(index));
    }

    expect(sent.map(({ items }) => items.length)).toEqual([MAX_IMPRESSIONS_PER_BATCH]);
    impressions.flush();
    expect(sent.map(({ items }) => items.length)).toEqual([MAX_IMPRESSIONS_PER_BATCH, 1]);
  });

  it('counts a card once per page view, and again in the next', () => {
    const { sent, queue: impressions } = queue();

    impressions.view('/');
    impressions.record(impression(1));
    impressions.record(impression(1));
    impressions.flush();
    impressions.view('/');
    impressions.record(impression(1));
    impressions.flush();
    impressions.view('/feed/trending');
    impressions.record(impression(1));
    impressions.flush();

    expect(sent).toEqual([{ items: [impression(1)] }, { items: [impression(1)] }]);
  });

  it('sends nothing when nothing came into view', () => {
    const { sent, queue: impressions } = queue();

    impressions.flush();
    vi.runAllTimers();

    expect(sent).toEqual([]);
  });
});
