import { createHash } from 'node:crypto';
import type { DemoOptions } from '../../types';
import { buildWorld } from '../world';

const OPTIONS: DemoOptions = {
  profile: 'minimal',
  videos: 8,
  users: 12,
  channels: 4,
  seed: 1729,
  withWorker: true,
  apiUrl: 'http://localhost:3000',
  workDir: '.demo',
  dryRun: false,
};

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

describe('seed/world: buildWorld', () => {
  it('builds the same world, byte for byte, from the same seed', () => {
    expect(hash(buildWorld(OPTIONS))).toBe(hash(buildWorld({ ...OPTIONS })));
    expect(hash(buildWorld(OPTIONS))).toBe(
      '118f57f423f3737af3aff546e2405b263d19eed483b35c47150e9f724d8de94c'
    );
  });

  it('builds another world from another seed', () => {
    expect(hash(buildWorld({ ...OPTIONS, seed: 1730 }))).not.toBe(hash(buildWorld(OPTIONS)));
  });

  it('sizes the world from the options', () => {
    const world = buildWorld(OPTIONS);

    expect(world.users).toHaveLength(12);
    expect(world.videos).toHaveLength(8);
    expect(world.users.filter((user) => user.ownsChannel)).toHaveLength(4);
    expect(world.categories.map((category) => category.sortOrder)).toEqual(
      world.categories.map((_, index) => index)
    );
  });

  it('keeps every video on a category and an owner that exist', () => {
    const world = buildWorld({ ...OPTIONS, profile: 'full', videos: 24 });
    const slugs = new Set(world.categories.map((category) => category.slug));
    const ids = new Set(world.users.map((user) => user.id));

    expect(world.videos.every((v) => slugs.has(v.categorySlug) && ids.has(v.ownerId))).toBe(true);
  });
});
