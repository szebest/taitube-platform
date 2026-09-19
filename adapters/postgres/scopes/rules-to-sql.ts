import { rulesToAST } from '@casl/ability/extra';
import type { Condition } from '@ucast/core';
import type { AppAbility, AppAction, AppSubjects, UserContext } from '@vp/permissions';
import { getUserPermissions } from '@vp/permissions';
import { type Column, type SQL, and, eq, inArray, isNotNull, isNull, ne, or } from 'drizzle-orm';
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

/**
 * Compiles CASL rules directly into Drizzle SQL WHERE conditions via @casl/ability/extra rulesToAST.
 * Single source of truth: CASL rules automatically translate to PostgreSQL query clauses!
 */
export function rulesToSql<T extends TableConfig>(
  action: AppAction,
  subject: AppSubjects,
  user: UserContext | null | undefined,
  table: PgTableWithColumns<T>
): SQL | undefined {
  const ability = getUserPermissions(user ?? null);
  const ast = rulesToAST(ability, action, subject as Parameters<typeof rulesToAST<AppAbility>>[2]);

  if (ast == null) return undefined;

  return getConditionSql(ast as unknown as AstCondition, table);
}

export function getConditionSql<T extends TableConfig>(
  condition: AstCondition | Condition,
  table: PgTableWithColumns<T>
): SQL | undefined {
  if (Array.isArray(condition.value)) {
    const compound = condition as AstCompoundCondition;
    switch (compound.operator) {
      case 'and':
        return drizzleAnd(compound, table);
      case 'or':
        return drizzleOr(compound, table);
      default: {
        throw new Error(`Unsupported compound condition operator: ${compound.operator}`);
      }
    }
  }

  if ('field' in condition) {
    const fieldCond = condition as AstFieldCondition;
    switch (fieldCond.operator) {
      case 'eq': {
        return drizzleEq(fieldCond, table);
      }
      case 'ne': {
        return drizzleNe(fieldCond, table);
      }
      case 'in': {
        return drizzleIn(fieldCond, table);
      }
      case 'exists': {
        return drizzleExists(fieldCond, table);
      }
      default: {
        throw new Error(`Unsupported field condition operator: ${fieldCond.operator}`);
      }
    }
  }

  return undefined;
}

function drizzleEq<T extends TableConfig>(
  condition: AstFieldCondition,
  table: PgTableWithColumns<T>
): SQL | undefined {
  const column = (table as unknown as Record<string, Column>)[condition.field];
  if (!column) return undefined;
  return eq(column, condition.value);
}

function drizzleNe<T extends TableConfig>(
  condition: AstFieldCondition,
  table: PgTableWithColumns<T>
): SQL | undefined {
  const column = (table as unknown as Record<string, Column>)[condition.field];
  if (!column) return undefined;
  return ne(column, condition.value);
}

function drizzleIn<T extends TableConfig>(
  condition: AstFieldCondition,
  table: PgTableWithColumns<T>
): SQL | undefined {
  const column = (table as unknown as Record<string, Column>)[condition.field];
  if (!column) return undefined;
  return inArray(column, condition.value as unknown[]);
}

function drizzleExists<T extends TableConfig>(
  condition: AstFieldCondition,
  table: PgTableWithColumns<T>
): SQL | undefined {
  const column = (table as unknown as Record<string, Column>)[condition.field];
  if (!column) return undefined;
  return condition.value === false ? isNull(column) : isNotNull(column);
}

function drizzleAnd<T extends TableConfig>(
  condition: AstCompoundCondition,
  table: PgTableWithColumns<T>
): SQL | undefined {
  const conditions = condition.value
    .map((cond) => getConditionSql(cond, table))
    .filter((c): c is SQL => c !== undefined);
  if (conditions.length === 0) return undefined;
  return and(...conditions);
}

function drizzleOr<T extends TableConfig>(
  condition: AstCompoundCondition,
  table: PgTableWithColumns<T>
): SQL | undefined {
  const conditions = condition.value
    .map((cond) => getConditionSql(cond, table))
    .filter((c): c is SQL => c !== undefined);
  if (conditions.length === 0) return undefined;
  return or(...conditions);
}
