import type { Environment } from './environment-spec';
import { type KeyDocs, requiredKeys } from './required-keys';

export interface SecretsReport {
  expected: string[];
  missing: string[];
  empty: string[];
  localCredentials: string[];
  unexpected: string[];
}

const LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/;

function unquoted(value: string): string {
  const trimmed = value.trim();
  const quote = trimmed[0];
  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote) && trimmed.length > 1) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/** @internal The names an env file sets and what each is set to; the caller must never print the values. */
export function parseEnvFile(text: string): Map<string, string> {
  const entries = text
    .split('\n')
    .map((line) => LINE.exec(line))
    .filter((match) => match !== null)
    .map((match): [string, string] => [match[1] as string, unquoted(match[2] as string)]);
  return new Map(entries);
}

function isPlaceholder(value: string): boolean {
  return value === '' || /^<.*>$/.test(value);
}

export function secretsReport(
  env: Environment,
  docs: KeyDocs,
  fileText: string | undefined,
  isLocalCredential: (value: string) => boolean
): SecretsReport {
  const expected = [...new Set([...env.secrets.keys, ...requiredKeys(env, docs).secrets])].sort();
  const values = parseEnvFile(fileText ?? '');
  const missing = expected.filter((key) => !values.has(key));
  const empty = expected.filter((key) => isPlaceholder(values.get(key) ?? 'x'));
  const localCredentials = expected.filter((key) => {
    const value = values.get(key);
    return value !== undefined && !isPlaceholder(value) && isLocalCredential(value);
  });
  const unexpected = [...values.keys()].filter((key) => !expected.includes(key)).sort();
  return { expected, missing, empty, localCredentials, unexpected };
}

export function secretsOk(report: SecretsReport, env: Environment): boolean {
  const blocking = report.missing.length + report.empty.length;
  return blocking === 0 && (!env.production || report.localCredentials.length === 0);
}

export function formatSecretsReport(env: Environment, report: SecretsReport, file: string): string {
  const lines = [`secrets for ${env.name} (${file}), names only:`];
  const list = (label: string, keys: string[]) => {
    if (keys.length > 0) lines.push(`  ${label}: ${keys.join(', ')}`);
  };
  const ready = report.expected.filter(
    (key) => !report.missing.includes(key) && !report.empty.includes(key)
  );
  list('ok', ready);
  list('missing', report.missing);
  list(
    'empty or placeholder',
    report.empty.filter((key) => !report.missing.includes(key))
  );
  list('holds a credential this repo ships for local use', report.localCredentials);
  list('not expected by the environment', report.unexpected);
  lines.push(
    secretsOk(report, env)
      ? 'result: every expected secret is present'
      : 'result: fix the lines above'
  );
  return lines.join('\n');
}
