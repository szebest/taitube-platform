import { HeldViews } from '../held-views';

const VIEW = { videoId: 'video-1', viewerId: 'viewer-1', viewDate: '2026-03-10', watchSeconds: 8 };
const OTHER = { ...VIEW, viewerId: 'viewer-2', watchSeconds: 4 };

describe('HeldViews', () => {
  it('holds one view per viewer, video and day, as the events themselves', () => {
    const held = new HeldViews(10);

    expect(held.record(VIEW)).toBe('deferred');
    expect(held.record(VIEW)).toBe('duplicate');
    expect(held.record(OTHER)).toBe('deferred');

    expect(held.drain()).toEqual([VIEW, OTHER]);
  });

  it('drops a new viewer once it holds as many as its capacity', () => {
    const held = new HeldViews(1);
    held.record(VIEW);

    expect(held.record(OTHER)).toBe('dropped');
  });

  it('empties on drain, viewers included', () => {
    const held = new HeldViews(1);
    held.record(VIEW);
    held.drain();

    expect(held.drain()).toEqual([]);
    expect(held.record(VIEW)).toBe('deferred');
  });

  it('takes back what a failed hand-back returned, without doubling a viewer held since', () => {
    const held = new HeldViews(10);
    held.record(VIEW);
    const drained = held.drain();
    held.record(VIEW);
    held.record(OTHER);

    held.restore(drained);

    expect(held.drain()).toEqual([VIEW, OTHER]);
  });
});
