import { AppEnvSchema } from '../../packages/server/env-schema/src/index';
import { read } from './repo-files';

const KEY = /^[A-Z][A-Z0-9_]*$/;

const ENV_SCHEMA = 'packages/server/env-schema/src/';

/** The keys this repo hands to something other than its own code, each with the consumer that reads it. */
export function platformKeys(): string[] {
  return Object.keys(JSON.parse(read(`${ENV_SCHEMA}platform-env.json`)));
}

/** Every key the environment schema declares. */
export function schemaKeys(): Set<string> {
  return new Set([...Object.keys(AppEnvSchema.innerType().shape), ...platformKeys()]);
}

export function exampleKeys(): Set<string> {
  return new Set(
    [...read('.env.example').matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1] as string)
  );
}

export function envReads(source: string): string[] {
  return [
    ...source.matchAll(/process\.env(?:\.([A-Z][A-Z0-9_]*)|\[\s*['"]([A-Z][A-Z0-9_]*)['"]\s*\])/g),
  ].map((m) => (m[1] ?? m[2]) as string);
}

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

/** The mapping keys directly under `line`, one level deeper, ending where the indent returns. */
function childKeys(lines: string[], at: number): string[] {
  const own = indentOf(lines[at] as string);
  const keys: string[] = [];
  for (const line of lines.slice(at + 1)) {
    if (line.trim() === '') continue;
    if (indentOf(line) <= own) break;
    const key = /^\s*([A-Za-z0-9_]+):/.exec(line)?.[1];
    if (key && KEY.test(key)) keys.push(key);
  }
  return keys;
}

/** Keys an app container receives: the shared anchor and each app service's environment. */
export function composeAppKeys(source: string): string[] {
  const lines = source.split('\n');
  const keys: string[] = [];
  lines.forEach((line, at) => {
    if (/^x-app-env:/.test(line)) keys.push(...childKeys(lines, at));
  });

  const services = source.split(/\n(?= {2}[\w-]+:\n)/);
  for (const service of services) {
    if (!/image: vp-[\w-]+:local|<<: \*worker/.test(service)) continue;
    const serviceLines = service.split('\n');
    serviceLines.forEach((line, at) => {
      if (/^\s{4}environment:\s*$/.test(line)) keys.push(...childKeys(serviceLines, at));
    });
  }
  return keys;
}

/**
 * Keys a manifest hands the app pods: ConfigMap and Secret entries, container env names, the keys an
 * overlay patches into them and the keys an ExternalSecret materialises.
 */
export function k8sAppKeys(source: string): string[] {
  const lines = source.split('\n');
  const keys: string[] = [];
  lines.forEach((line, at) => {
    if (/^(data|stringData):\s*$/.test(line)) keys.push(...childKeys(lines, at));
  });
  keys.push(
    ...[...source.matchAll(/^\s*- name: ([A-Z][A-Z0-9_]+)\s*$/gm)].map((m) => m[1] as string),
    ...[...source.matchAll(/\bpath: \/(?:data|stringData)\/([A-Z][A-Z0-9_]+)\s*$/gm)].map(
      (m) => m[1] as string
    ),
    ...[...source.matchAll(/^\s*- secretKey: ([A-Z][A-Z0-9_]+)\s*$/gm)].map((m) => m[1] as string)
  );
  return keys;
}

/** Keys a CI step hands a process that runs this repo's code (`pnpm ...`). */
export function workflowAppKeys(source: string): string[] {
  const lines = source.split('\n');
  const keys: string[] = [];
  lines.forEach((line, at) => {
    if (!/^\s*env:\s*$/.test(line)) return;
    const own = indentOf(line);
    const step: string[] = [];
    for (const sibling of lines.slice(at + 1)) {
      if (sibling.trim() !== '' && indentOf(sibling) < own) break;
      step.push(sibling);
    }
    const runsThisCode =
      own === 0 ? /\brun:.*\bpnpm\b/.test(source) : step.some((l) => /^\s*run:.*\bpnpm\b/.test(l));
    if (runsThisCode) {
      keys.push(...childKeys(lines, at));
    }
  });
  return keys;
}

/** Keys a Makefile recipe sets as a prefix of a command that runs this repo's code. */
export function makefileAppKeys(source: string): string[] {
  const prefixed = /((?:\b[A-Z][A-Z0-9_]*=\S+\s+)+)(?:node|bun|pnpm|tsx)\s/g;
  return [...source.matchAll(prefixed)].flatMap((m) =>
    [...(m[1] as string).matchAll(/\b([A-Z][A-Z0-9_]*)=/g)].map((k) => k[1] as string)
  );
}
