import { rulesToAST } from '@casl/ability/extra';
import type { AppAbility, AppAction, AppSubjects, UserContext } from '@vp/permissions';
import { getUserPermissions } from '@vp/permissions';
import { type SQL, sql } from 'drizzle-orm';
import type { PgTableWithColumns, TableConfig } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { type AstCondition, getConditionSql } from './condition-sql';

const FieldConditionSchema = z
  .object({ operator: z.string(), field: z.string(), value: z.unknown() })
  .transform(({ operator, field, value }) => ({ type: 'field' as const, operator, field, value }));

/**
 * rulesToAST returns condition classes from whichever `@ucast/core` CASL resolves, so the tree is
 * parsed by shape rather than matched by `instanceof`. A field condition is tried first because an
 * `in` condition also carries an array value.
 */
const AstConditionSchema: z.ZodType<AstCondition, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.union([
    FieldConditionSchema,
    z
      .object({ operator: z.string(), value: z.array(AstConditionSchema) })
      .transform((condition) => ({ type: 'compound' as const, ...condition })),
  ])
);

export type Viewer = UserContext | null;

/**
 * Compiles CASL rules into Drizzle SQL WHERE conditions via @casl/ability/extra rulesToAST,
 * so row scoping and in-memory can() decisions derive from one rule set.
 *
 * Three outcomes: `undefined` imposes no restriction (rule grants the action unconditionally),
 * a condition restricts the rows, and a forbidden action yields a predicate matching no rows.
 */
export function rulesToSql<T extends TableConfig>(
  action: AppAction,
  subject: AppSubjects,
  viewer: Viewer,
  table: PgTableWithColumns<T>
): SQL | undefined {
  const ability = getUserPermissions(viewer);
  const ast = rulesToAST(ability, action, subject as Parameters<typeof rulesToAST<AppAbility>>[2]);

  // A null AST means no rule grants the action; returning undefined would leave the query unfiltered.
  if (ast == null) {
    return sql`false`;
  }

  return getConditionSql(AstConditionSchema.parse(ast), table);
}
