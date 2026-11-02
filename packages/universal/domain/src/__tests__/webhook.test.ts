import { MAX_WEBHOOKS_PER_USER, WEBHOOK_EVENTS } from '../webhook';

describe('@vp/domain: webhook', () => {
  it('names the events a creator can subscribe to', () => {
    expect(WEBHOOK_EVENTS).toEqual(['video.ready', 'live.started']);
  });

  it('caps what one user can register', () => {
    expect(MAX_WEBHOOKS_PER_USER).toBe(10);
  });
});
