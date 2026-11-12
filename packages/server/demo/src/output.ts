import { PERSONAS } from './logins';
import type { Endpoint } from './urls';

export interface Style {
  bold: (text: string) => string;
  dim: (text: string) => string;
  green: (text: string) => string;
  red: (text: string) => string;
  yellow: (text: string) => string;
}

export function styleFor(tty: boolean, env: Readonly<Record<string, string | undefined>>): Style {
  const on = tty && !env.NO_COLOR;
  const wrap = (code: number) => (text: string) => (on ? `\u001b[${code}m${text}\u001b[0m` : text);
  return { bold: wrap(1), dim: wrap(2), green: wrap(32), red: wrap(31), yellow: wrap(33) };
}

export function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function renderSummary(endpoints: readonly Endpoint[], style: Style): string {
  const width = Math.max(...endpoints.map((e) => e.label.length));
  const urlWidth = Math.max(...endpoints.map((e) => e.url.length));
  const rows = endpoints.map(
    (e) => `  ${style.bold(e.label.padEnd(width))}  ${e.url.padEnd(urlWidth)}  ${style.dim(e.note)}`
  );
  const personas = PERSONAS.map(
    (p) =>
      `  ${style.bold(p.name.padEnd(width))}  ${p.role.padEnd(urlWidth)}  ${style.dim(`pnpm demo login ${p.name}`)}`
  );
  return [
    '',
    style.bold('Services'),
    ...rows,
    '',
    style.bold('Personas'),
    ...personas,
    '',
    style.dim(
      'Sign in: pnpm demo login <persona> prints a token, a curl line and a DevTools cookie one-liner.'
    ),
  ].join('\n');
}
