import { videos } from '@vp/db';
import type { UserContext } from '@vp/permissions';
import { getConditionSql, rulesToSql } from '../rules-to-sql';
import { sqlParams, sqlText } from './sql-text';

describe('adapters/postgres/scoping: rules-to-sql compiler', () => {
  const guest: UserContext | null = null;
  const standardUser: UserContext = { id: 'usr-123', role: 'USER' };
  const creator: UserContext = { id: 'usr-123', role: 'CREATOR' };
  const moderator: UserContext = { id: 'mod-456', role: 'MODERATOR' };
  const admin: UserContext = { id: 'adm-789', role: 'ADMIN' };

  describe('read scoping compiles the same rules the ability evaluates', () => {
    it.each([
      {
        name: 'guest sees public and unlisted only',
        user: guest,
        sql: '("videos"."visibility" = $1 or "videos"."visibility" = $2)',
        params: ['unlisted', 'public'],
      },
      {
        name: 'authenticated user additionally sees own videos',
        user: standardUser,
        sql: '("videos"."owner_id" = $1 or "videos"."visibility" = $2 or "videos"."visibility" = $3)',
        params: ['usr-123', 'unlisted', 'public'],
      },
    ])('$name', ({ user, sql, params }) => {
      const condition = rulesToSql('read', 'Video', user, videos);
      expect(sqlText(condition)).toBe(sql);
      expect(sqlParams(condition)).toEqual(params);
    });

    it.each([
      { name: 'moderator', user: moderator },
      { name: 'admin', user: admin },
    ])('$name reads unrestricted, so no condition is emitted', ({ user }) => {
      expect(rulesToSql('read', 'Video', user, videos)).toBeUndefined();
    });
  });

  describe('forbidden actions', () => {
    it.each([
      { name: 'guest cannot publish', user: guest },
      { name: 'plain user cannot publish', user: standardUser },
    ])('$name, so the scope matches no rows', ({ user }) => {
      const condition = rulesToSql('publish', 'Video', user, videos);
      expect(sqlText(condition)).toBe('false');
    });

    it('creator publishes only own videos', () => {
      const condition = rulesToSql('publish', 'Video', creator, videos);
      expect(sqlText(condition)).toBe('"videos"."owner_id" = $1');
      expect(sqlParams(condition)).toEqual(['usr-123']);
    });
  });

  describe('operator compilation', () => {
    it.each([
      {
        name: 'in',
        condition: { operator: 'in', field: 'status', value: ['READY', 'FAILED'] },
        sql: '"videos"."status" in ($1, $2)',
      },
      {
        name: 'ne',
        condition: { operator: 'ne', field: 'status', value: 'DELETED' },
        sql: '"videos"."status" <> $1',
      },
      {
        name: 'exists false',
        condition: { operator: 'exists', field: 'deletedAt', value: false },
        sql: '"videos"."deleted_at" is null',
      },
      {
        name: 'exists true',
        condition: { operator: 'exists', field: 'deletedAt', value: true },
        sql: '"videos"."deleted_at" is not null',
      },
    ])('compiles a $name condition', ({ condition, sql }) => {
      expect(sqlText(getConditionSql(condition, videos))).toBe(sql);
    });

    it('rejects a condition on a column the table does not have', () => {
      expect(() =>
        getConditionSql({ operator: 'eq', field: 'userId', value: 'usr-1' }, videos)
      ).toThrow(/unknown column "userId"/);
    });

    it.each([
      { kind: 'field', condition: { operator: 'regex', field: 'title', value: '^a' } },
      { kind: 'compound', condition: { operator: 'nor', value: [] } },
    ])('rejects an unsupported $kind operator', ({ condition }) => {
      expect(() => getConditionSql(condition, videos)).toThrow(/Unsupported/);
    });
  });
});
