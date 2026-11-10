import type { Environment } from './environment-spec';

interface KeyDoc {
  visibility: 'secret' | 'public';
  requiredIn?: readonly string[];
}

export type KeyDocs = Readonly<Record<string, KeyDoc>>;

export interface RequiredKeys {
  secrets: string[];
  config: string[];
}

function authMode(env: Environment): string {
  return env.config['AUTH_MODE'] ?? 'jwks';
}

/** What a production boot refuses to start without: the registry's `requiredIn`, read for this environment. */
export function requiredKeys(env: Environment, docs: KeyDocs): RequiredKeys {
  const required = env.production
    ? Object.entries(docs).filter(([, doc]) => {
        const when = doc.requiredIn ?? [];
        return (
          when.includes('production') || (when.includes('jwks-auth') && authMode(env) === 'jwks')
        );
      })
    : [];
  const names = (visibility: KeyDoc['visibility']) =>
    required
      .filter(([, doc]) => doc.visibility === visibility)
      .map(([key]) => key)
      .sort();
  return { secrets: names('secret'), config: names('public') };
}

export function consistencyFindings(env: Environment, docs: KeyDocs, file: string): string[] {
  const findings: string[] = [];
  const required = requiredKeys(env, docs);
  const declared = new Set(env.secrets.keys);

  for (const key of required.secrets) {
    if (!declared.has(key)) {
      findings.push(
        `${env.name}: ${key} is a secret a production boot requires: add it to secrets.keys in ${file}`
      );
    }
  }
  for (const key of required.config) {
    if (!Object.hasOwn(env.config, key) && !declared.has(key)) {
      findings.push(
        `${env.name}: ${key} is required in production: set it under config (or secrets.keys) in ${file}`
      );
    }
  }
  for (const key of [...declared, ...Object.keys(env.config)]) {
    if (!Object.hasOwn(docs, key)) {
      findings.push(
        `${env.name}: ${key} is in neither the env schema nor EXTRA_ENV_DOCS: fix the name in ${file} or document the key`
      );
    }
  }
  return findings;
}
