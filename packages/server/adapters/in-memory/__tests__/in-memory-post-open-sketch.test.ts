import { expectOk } from '@kit/testing/result';
import { InMemoryPostOpenSketch } from '../in-memory-post-open-sketch';

describe('InMemoryPostOpenSketch', () => {
  it('counts a viewer once per post and day, and again on the next day or for another post', async () => {
    const sketch = new InMemoryPostOpenSketch();
    const open = async (post: string, viewer: string, day: string) =>
      expectOk(await sketch.record(post, viewer, day));

    expect([
      await open('p1', 'u1', '2026-03-01'),
      await open('p1', 'u1', '2026-03-01'),
      await open('p1', 'u1', '2026-03-02'),
      await open('p2', 'u1', '2026-03-01'),
      await open('p1', 'u2', '2026-03-01'),
    ]).toEqual([true, false, true, true, true]);
  });

  it('forgets everything on clear', async () => {
    const sketch = new InMemoryPostOpenSketch();
    expectOk(await sketch.record('p1', 'u1', '2026-03-01'));

    sketch.clear();

    expect(expectOk(await sketch.record('p1', 'u1', '2026-03-01'))).toBe(true);
  });
});
