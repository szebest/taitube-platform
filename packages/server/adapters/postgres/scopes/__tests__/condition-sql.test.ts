import { videos } from '@vp/db';
import { sql } from 'drizzle-orm';
import { type AstCondition, getConditionSql } from '../condition-sql';
import { sqlText } from './sql-text';

describe('adapters/postgres/scoping: condition compiler', () => {
  it.each<{ name: string; condition: AstCondition; sql: string }>([
    {
      name: 'in',
      condition: { type: 'field', operator: 'in', field: 'status', value: ['READY', 'FAILED'] },
      sql: '"videos"."status" in ($1, $2)',
    },
    {
      name: 'ne',
      condition: { type: 'field', operator: 'ne', field: 'status', value: 'DELETED' },
      sql: '"videos"."status" <> $1',
    },
    {
      name: 'exists false',
      condition: { type: 'field', operator: 'exists', field: 'deletedAt', value: false },
      sql: '"videos"."deleted_at" is null',
    },
    {
      name: 'exists true',
      condition: { type: 'field', operator: 'exists', field: 'deletedAt', value: true },
      sql: '"videos"."deleted_at" is not null',
    },
  ])('compiles a $name condition', ({ condition, sql }) => {
    expect(sqlText(getConditionSql(condition, videos))).toBe(sql);
  });

  it('compiles a field the table lacks through the expression that stands for it', () => {
    const condition: AstCondition = { type: 'field', operator: 'eq', field: 'seat', value: 'usr-1' };

    expect(sqlText(getConditionSql(condition, videos, { seat: sql`(select 1)` }))).toBe(
      '(select 1) = $1'
    );
  });

  it('rejects a condition on a column the table does not have', () => {
    expect(() =>
      getConditionSql({ type: 'field', operator: 'eq', field: 'userId', value: 'usr-1' }, videos)
    ).toThrow(/unknown column "userId"/);
  });

  it.each<{ kind: string; condition: AstCondition }>([
    {
      kind: 'field',
      condition: { type: 'field', operator: 'regex', field: 'title', value: '^a' },
    },
    { kind: 'compound', condition: { type: 'compound', operator: 'nor', value: [] } },
  ])('rejects an unsupported $kind operator', ({ condition }) => {
    expect(() => getConditionSql(condition, videos)).toThrow(/Unsupported/);
  });
});
