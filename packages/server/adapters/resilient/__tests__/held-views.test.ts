import { HeldViews } from '../held-views';

const VIEW = { videoId: 'video-1', viewerId: 'viewer-1', viewDate: '2026-03-10', watchSeconds: 8 };

describe('HeldViews', () => {
  it('holds one view per viewer, video and day', () => {
    const held = new HeldViews(10);

    expect(held.record(VIEW)).toBe('deferred');
    expect(held.record(VIEW)).toBe('duplicate');
    expect(held.record({ ...VIEW, viewerId: 'viewer-2', watchSeconds: 4 })).toBe('deferred');

    expect(held.drain()).toEqual([
      { videoId: 'video-1', viewDate: '2026-03-10', views: 2, watchSeconds: 12 },
    ]);
  });

  it('drops a new viewer once it holds as many as its capacity', () => {
    const held = new HeldViews(1);
    held.record(VIEW);

    expect(held.record({ ...VIEW, viewerId: 'viewer-2' })).toBe('dropped');
  });

  it('empties on drain, viewers included', () => {
    const held = new HeldViews(1);
    held.record(VIEW);
    held.drain();

    expect(held.drain()).toEqual([]);
    expect(held.record(VIEW)).toBe('deferred');
  });

  it('takes back counts a failed hand-back returned', () => {
    const held = new HeldViews(10);
    held.record(VIEW);
    const drained = held.drain();
    held.record({ ...VIEW, viewerId: 'viewer-2' });

    held.restore(drained);

    expect(held.drain()).toEqual([
      { videoId: 'video-1', viewDate: '2026-03-10', views: 2, watchSeconds: 16 },
    ]);
  });
});
