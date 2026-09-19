import { videos } from '@vp/db';
import type { UserContext } from '@vp/permissions';
import { describe, expect, it } from 'vitest';
import { rulesToSql } from '../rules-to-sql';

describe('adapters/postgres/scoping: rules-to-sql compiler', () => {
  const guestUser: UserContext | null = null;
  const standardUser: UserContext = { id: 'usr-123', role: 'USER' };
  const adminUser: UserContext = { id: 'adm-789', role: 'ADMIN' };

  it('compiles public/unlisted visibility rules for guest into SQL condition', () => {
    const sql = rulesToSql('read', 'Video', guestUser, videos);
    expect(sql).toBeDefined();
  });

  it('returns undefined (unconditional bypass) for admin user', () => {
    const sql = rulesToSql('read', 'Video', adminUser, videos);
    expect(sql).toBeUndefined();
  });

  it('compiles visibility and ownership conditions for authenticated user', () => {
    const sql = rulesToSql('read', 'Video', standardUser, videos);
    expect(sql).toBeDefined();
  });
});
