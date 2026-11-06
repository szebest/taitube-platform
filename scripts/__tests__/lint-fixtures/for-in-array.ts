export function sumIndexes(values: number[]): string {
  let joined = '';
  for (const index in values) joined += index;
  return joined;
}
