import { SYNC_CHANNEL } from '../sync-messages';

describe('apps/client/web: sync messages', () => {
  it('names the channel the worker and the pages share', () => {
    expect(SYNC_CHANNEL).toBe('taitube-sync');
  });
});
