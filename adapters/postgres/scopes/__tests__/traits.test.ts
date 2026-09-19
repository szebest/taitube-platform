import { videos } from '@vp/db';
import { describe, expect, it } from 'vitest';
import type { OwnableAndVisible, SoftDeletable, WithOwner, WithVisibility } from '../traits';

describe('adapters/postgres/scoping: traits', () => {
  it('allows tables matching WithOwner to be typechecked', () => {
    const table: WithOwner = videos;
    expect(table.ownerId).toBeDefined();
  });

  it('allows tables matching WithVisibility to be typechecked', () => {
    const table: WithVisibility = videos;
    expect(table.visibility).toBeDefined();
  });

  it('allows tables matching SoftDeletable to be typechecked', () => {
    const table: SoftDeletable = videos;
    expect(table.deletedAt).toBeDefined();
    expect(table.status).toBeDefined();
  });

  it('allows tables matching OwnableAndVisible to be typechecked', () => {
    const table: OwnableAndVisible = videos;
    expect(table.ownerId).toBeDefined();
    expect(table.visibility).toBeDefined();
  });
});
