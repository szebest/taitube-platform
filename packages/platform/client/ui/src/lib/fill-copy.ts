/** A word with `{name}` placeholders, filled by a primitive that knows the values. */
export function fillCopy(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    String(values[key] ?? placeholder)
  );
}
