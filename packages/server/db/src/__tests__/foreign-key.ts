import { type PgTable, getTableConfig } from 'drizzle-orm/pg-core';

export function referenceFrom(table: PgTable, column: string) {
  const foreignKey = getTableConfig(table).foreignKeys.find((key) =>
    key.reference().columns.some((local) => local.name === column)
  );
  const reference = foreignKey?.reference();
  return {
    table: reference === undefined ? undefined : getTableConfig(reference.foreignTable).name,
    onDelete: foreignKey?.onDelete,
  };
}
