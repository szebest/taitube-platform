import { assertNever } from '@kit/result';
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
} from 'drizzle-orm';
import type { PgTableWithColumns, TableConfig } from 'drizzle-orm/pg-core';
import { z } from 'zod';

export type AstCondition =
  | { type: 'field'; operator: string; field: string; value: unknown }
  | { type: 'compound'; operator: string; value: AstCondition[] };

const InValuesSchema = z.array(z.unknown());

/**
 * A resource field that is no column of the table, such as a seat resolved per caller, and the
 * expression that stands for it in SQL.
 */
export type DerivedFields = Readonly<Record<string, SQL>>;

export function getConditionSql<T extends TableConfig>(
  condition: AstCondition,
  table: PgTableWithColumns<T>,
  derived: DerivedFields = {}
): SQL | undefined {
  switch (condition.type) {
    case 'field': {
      const expression = derived[condition.field];
      return expression
        ? derivedSql(condition, expression)
        : fieldSql(condition, resolveColumn(condition.field, table));
    }
    case 'compound':
      return compoundSql(condition, table, derived);
    default:
      return assertNever(condition, 'AstCondition');
  }
}

/** A derived field is matched for equality alone: a seat either is the caller's or is not. */
function derivedSql(condition: Extract<AstCondition, { type: 'field' }>, expression: SQL): SQL {
  if (condition.operator !== 'eq') {
    throw new Error(`Unsupported derived field operator: ${condition.operator}`);
  }
  return eq(expression, condition.value);
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
  table: PgTableWithColumns<T>,
  derived: DerivedFields
): SQL | undefined {
  const parts = condition.value
    .map((part) => getConditionSql(part, table, derived))
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
