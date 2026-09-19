import { videos } from '@vp/db';
import { describe, expect, it } from 'vitest';
import { notDeletedScope } from '../soft-delete';

describe('adapters/postgres/scoping: soft-delete scope', () => {
  it('generates soft-delete conditions for tables with deletedAt and status', () => {
    const scope = notDeletedScope(videos);
    expect(scope).toBeDefined();
  });

  it('handles tables without soft-delete columns gracefully', () => {
    const emptyTable = {};
    expect(notDeletedScope(emptyTable)).toBeUndefined();
  });
});
