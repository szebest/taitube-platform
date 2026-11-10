const quote = (value: string): string => `'${value.replaceAll("'", `'\\''`)}'`;

const name = (path: readonly string[]): string =>
  `E_${path.join('_').replace(/[^A-Za-z0-9]/g, '_')}`;

function lines(value: unknown, path: readonly string[]): string[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return [`${name(path)}=${quote(value.join(' '))}`];
  if (typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => lines(child, [...path, key]));
  }
  return [`${name(path)}=${quote(String(value))}`];
}

/**
 * An environment as `E_<path>='value'` lines a shell can `eval`: `cluster.context` becomes
 * `E_cluster_context`, a list becomes its items joined by spaces. One read, so the script does not start
 * Node for every field.
 */
export function shellVars(environment: object): string {
  return lines(environment, []).join('\n');
}
