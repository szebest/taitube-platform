export function table(
  header: readonly string[],
  rows: readonly (readonly (string | number)[])[]
): string {
  return [header, header.map(() => '---'), ...rows]
    .map((cells) => `| ${cells.join(' | ')} |`)
    .join('\n');
}

export function percent(part: number, whole: number): string {
  if (whole === 0) return 'n/a';
  return `${((100 * part) / whole).toFixed(1)}%`;
}

export const share = (part: number, whole: number): string =>
  `${part} of ${whole}, ${percent(part, whole)}`;
