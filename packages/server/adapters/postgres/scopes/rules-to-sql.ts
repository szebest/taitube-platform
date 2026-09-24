import { rulesToAST } from '@casl/ability/extra';
import type { AppAbility, AppAction, AppSubjects, UserContext } from '@vp/permissions';
import { getUserPermissions } from '@vp/permissions';
import { assertNever } from '@vp/result';
import {
  type Column,
  type SQL,
  and,
  eq,
  getTableColumns,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import type { PgTableWithColumns, TableConfig } from 'drizzle-orm/pg-core';
import { z } from 'zod';

export type AstCondition =
  | { type: 'field'; operator: string; field: string; value: unknown }
  | { type: 'compound'; operator: string; value: AstCondition[] };

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

const InValuesSchema = z.array(z.unknown());

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

export function getConditionSql<T extends TableConfig>(
  condition: AstCondition,
  table: PgTableWithColumns<T>
): SQL | undefined {
  switch (condition.type) {
    case 'field':
      return fieldSql(condition, resolveColumn(condition.field, table));
    case 'compound':
      return compoundSql(condition, table);
    default:
      return assertNever(condition, 'AstCondition');
  }
}

function fieldSql(condition: Extract<AstCondition, { type: 'field' }>, column: Column): SQL {
  switch (condition.operator) {
    case 'eq':
      return eq(column, condition.value);
    case 'ne':
      return ne(column, condition.value);
    case 'in':
      return inArray(column, InValuesSchema.parse(condition.value));
    case 'exists':
      return condition.value === false ? isNull(column) : isNotNull(column);
    default:
      throw new Error(`Unsupported field condition operator: ${condition.operator}`);
  }
}

function compoundSql<T extends TableConfig>(
  condition: Extract<AstCondition, { type: 'compound' }>,
  table: PgTableWithColumns<T>
): SQL | undefined {
  const parts = condition.value
    .map((part) => getConditionSql(part, table))
    .filter((part): part is SQL => part !== undefined);

  switch (condition.operator) {
    case 'and':
      return parts.length > 0 ? and(...parts) : undefined;
    case 'or':
      return parts.length > 0 ? or(...parts) : undefined;
    default:
      throw new Error(`Unsupported compound condition operator: ${condition.operator}`);
  }
}

function resolveColumn<T extends TableConfig>(field: string, table: PgTableWithColumns<T>): Column {
  const columns: Record<string, Column> = getTableColumns(table);
  const column = columns[field];

  // Skipping an unmappable field would widen an `and` branch into an unintended grant.
  if (!column) {
    throw new Error(`Cannot compile permission condition: unknown column "${field}"`);
  }

  return column;
}
