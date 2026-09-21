import { videos } from '@vp/db';
import type { SoftDeletable, WithOwner, WithVisibility } from '../traits';

describe('adapters/postgres/scoping: traits', () => {
  it('accepts the videos table as owned, visible and soft-deletable', () => {
    const owned: WithOwner = videos;
    const visible: WithVisibility = videos;
    const soft: SoftDeletable = videos;

    expect(owned.ownerId).toBeDefined();
    expect(visible.visibility).toBeDefined();
    expect(soft.deletedAt).toBeDefined();
    expect(soft.status).toBeDefined();
  });
});
