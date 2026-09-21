import { rulesToAST } from '@casl/ability/extra';
import type { Condition } from '@ucast/core';
import type { AppAbility, AppAction, AppSubjects, UserContext } from '@vp/permissions';
import { getUserPermissions } from '@vp/permissions';
import {
  type Column,
  type SQL,
  and,
  eq,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import type { PgTableWithColumns, TableConfig } from 'drizzle-orm/pg-core';

export interface AstCompoundCondition {
  operator: 'and' | 'or' | string;
  value: (AstCompoundCondition | AstFieldCondition)[];
}

export interface AstFieldCondition {
  operator: 'eq' | 'ne' | 'in' | 'exists' | string;
  field: string;
  value: unknown;
}

export type AstCondition = AstCompoundCondition | AstFieldCondition;

export type Viewer = AppAbility | UserContext | null | undefined;

function toAbility(viewer: Viewer): AppAbility {
  if (viewer != null && 'can' in viewer) {
    return viewer;
  }
  return getUserPermissions(viewer ?? null);
}

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
  const ability = toAbility(viewer);
  const ast = rulesToAST(ability, action, subject as Parameters<typeof rulesToAST<AppAbility>>[2]);

  // A null AST means no rule grants the action; returning undefined would leave the query unfiltered.
  if (ast == null) {
    return sql`false`;
  }

  return getConditionSql(ast as unknown as AstCondition, table);
}

export function getConditionSql<T extends TableConfig>(
  condition: AstCondition | Condition,
  table: PgTableWithColumns<T>
): SQL | undefined {
  // Field conditions are tested first: an `in` condition also carries an array value.
  if ('field' in condition) {
    const fieldCond = condition as AstFieldCondition;
    const column = resolveColumn(fieldCond.field, table);

    switch (fieldCond.operator) {
      case 'eq':
        return eq(column, fieldCond.value);
      case 'ne':
        return ne(column, fieldCond.value);
      case 'in':
        return inArray(column, fieldCond.value as unknown[]);
      case 'exists':
        return fieldCond.value === false ? isNull(column) : isNotNull(column);
      default:
        throw new Error(`Unsupported field condition operator: ${fieldCond.operator}`);
    }
  }

  if (Array.isArray(condition.value)) {
    const compound = condition as AstCompoundCondition;
    const parts = compileParts(compound, table);

    switch (compound.operator) {
      case 'and':
        return parts.length > 0 ? and(...parts) : undefined;
      case 'or':
        return parts.length > 0 ? or(...parts) : undefined;
      default:
        throw new Error(`Unsupported compound condition operator: ${compound.operator}`);
    }
  }

  return undefined;
}

function resolveColumn<T extends TableConfig>(field: string, table: PgTableWithColumns<T>): Column {
  const column = (table as unknown as Record<string, Column>)[field];

  // Skipping an unmappable field would widen an `and` branch into an unintended grant.
  if (!column) {
    throw new Error(`Cannot compile permission condition: unknown column "${field}"`);
  }

  return column;
}

function compileParts<T extends TableConfig>(
  condition: AstCompoundCondition,
  table: PgTableWithColumns<T>
): SQL[] {
  return condition.value
    .map((cond) => getConditionSql(cond, table))
    .filter((c): c is SQL => c !== undefined);
}
