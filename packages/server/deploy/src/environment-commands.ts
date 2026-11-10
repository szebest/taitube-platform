import type { Environment } from './environment-spec';
import { isKubernetes } from './environment-spec';
import { EXIT, type ExitCode } from './exit-codes';
import { confirmationFinding, contextFinding, tagFinding } from './guards';
import type { DeployHost } from './host';
import { resolveTag } from './image-tag';
import { ENVIRONMENTS_DIR, loadEnvironments } from './load-environments';
import { resolveNamespace } from './preview';
import { renderOverlay } from './render-overlay';
import { consistencyFindings } from './required-keys';
import { formatSecretsReport, secretsOk, secretsReport } from './secrets-check';
import { shellVars } from './shell-vars';

export interface CommandInput {
  environment: string | undefined;
  rest: readonly string[];
  slug: string | undefined;
  tag: string | undefined;
  file: string | undefined;
  context: string | undefined;
  yes: boolean;
  confirm: string | undefined;
}

type Found = { ok: true; env: Environment } | { ok: false; exit: ExitCode };

export function findEnvironment(host: DeployHost, name: string | undefined): Found {
  const { environments, problems } = loadEnvironments(host.root);
  if (problems.length > 0) {
    host.print(problems.join('\n'));
    return { ok: false, exit: EXIT.failure };
  }
  const env = environments.find((candidate) => candidate.name === name);
  if (env === undefined) {
    host.print(
      `unknown environment ${name ?? '(none)'}; one of: ${environments.map((e) => e.name).join(', ')}`
    );
    return { ok: false, exit: EXIT.usage };
  }
  return { ok: true, env };
}

export function list(host: DeployHost): ExitCode {
  const { environments, problems } = loadEnvironments(host.root);
  host.print(problems.join('\n'));
  for (const env of environments) host.print(`${env.name}\t${env.kind}\t${env.description}`);
  return problems.length > 0 ? EXIT.failure : EXIT.ok;
}

export function validate(host: DeployHost): ExitCode {
  const { environments, problems } = loadEnvironments(host.root);
  const findings = [
    ...problems,
    ...environments.flatMap((env) =>
      consistencyFindings(env, host.docs, `${ENVIRONMENTS_DIR}/${env.name}/environment.yaml`)
    ),
  ];
  host.print(
    findings.length > 0 ? findings.join('\n') : `${environments.length} environments valid`
  );
  return findings.length > 0 ? EXIT.failure : EXIT.ok;
}

function dig(value: unknown, path: readonly string[]): unknown {
  return path.reduce<unknown>(
    (node, key) => (typeof node === 'object' && node !== null ? Reflect.get(node, key) : undefined),
    value
  );
}

export function get(host: DeployHost, input: CommandInput): ExitCode {
  const found = findEnvironment(host, input.environment);
  if (!found.ok) return found.exit;
  const value = dig(found.env, (input.rest[0] ?? '').split('.').filter(Boolean));
  if (value === undefined) {
    host.print(`${input.environment} has no ${input.rest[0] ?? ''}`);
    return EXIT.failure;
  }
  host.print(typeof value === 'object' ? JSON.stringify(value) : String(value));
  return EXIT.ok;
}

export function vars(host: DeployHost, input: CommandInput): ExitCode {
  const found = findEnvironment(host, input.environment);
  if (!found.ok) return found.exit;
  host.print(shellVars(found.env));
  return EXIT.ok;
}

export function namespace(host: DeployHost, input: CommandInput): ExitCode {
  const found = findEnvironment(host, input.environment);
  if (!found.ok) return found.exit;
  if (!isKubernetes(found.env)) {
    host.print(`${found.env.name} is a compose environment: it has no namespace`);
    return EXIT.usage;
  }
  const resolved = resolveNamespace(found.env.cluster.namespace, input.slug);
  if (resolved === undefined) {
    host.print(
      `${found.env.name} needs --slug <branch or PR>: its namespace is ${found.env.cluster.namespace}`
    );
    return EXIT.usage;
  }
  host.print(resolved);
  return EXIT.ok;
}

export function render(host: DeployHost, input: CommandInput): ExitCode {
  const found = findEnvironment(host, input.environment);
  if (!found.ok) return found.exit;
  if (!isKubernetes(found.env)) {
    host.print(`${found.env.name} is a compose environment: nothing to render with kustomize`);
    return EXIT.usage;
  }
  const resolved = resolveNamespace(found.env.cluster.namespace, input.slug);
  if (resolved === undefined) {
    host.print(`${found.env.name} needs --slug <branch or PR>`);
    return EXIT.usage;
  }
  const tag = resolveTag(found.env.images.tag, input.tag, host.git(['rev-parse', 'HEAD'])?.trim());
  if (tag === undefined) {
    host.print('cannot resolve {sha}: not inside a git checkout, or pass --tag');
    return EXIT.prerequisite;
  }
  const overlay = renderOverlay(found.env, { namespace: resolved, tag, now: host.now() });
  for (const [file, text] of Object.entries(overlay.files))
    host.writeText(`${overlay.dir}/${file}`, text);
  host.print(overlay.dir);
  return EXIT.ok;
}

export function secretsCheck(host: DeployHost, input: CommandInput): ExitCode {
  const found = findEnvironment(host, input.environment);
  if (!found.ok) return found.exit;
  const file = input.file ?? `.secrets/${found.env.name}.env`;
  const text = host.readText(file);
  const report = secretsReport(found.env, host.docs, text, host.isLocalCredential);
  if (text === undefined) host.print(`${file} does not exist: every expected secret is missing`);
  host.print(formatSecretsReport(found.env, report, file));
  return secretsOk(report, found.env) ? EXIT.ok : EXIT.failure;
}

export function tag(host: DeployHost, input: CommandInput): ExitCode {
  const found = findEnvironment(host, input.environment);
  if (!found.ok) return found.exit;
  const resolved = resolveTag(
    found.env.images.tag,
    input.tag,
    host.git(['rev-parse', 'HEAD'])?.trim()
  );
  if (resolved === undefined) {
    host.print('cannot resolve {sha}: not inside a git checkout, or pass --tag');
    return EXIT.prerequisite;
  }
  host.print(resolved);
  return EXIT.ok;
}

function refusal(host: DeployHost, input: CommandInput, checkTag: boolean): ExitCode {
  const found = findEnvironment(host, input.environment);
  if (!found.ok) return found.exit;
  const findings = [
    contextFinding(found.env, input.context),
    checkTag ? tagFinding(found.env, input.tag ?? found.env.images.tag) : undefined,
    confirmationFinding(found.env, { yes: input.yes, typed: input.confirm }),
  ].filter((finding) => finding !== undefined);
  if (findings.length > 0) host.print(findings.join('\n'));
  return findings.length === 0 ? EXIT.ok : EXIT.failure;
}

export const gate = (host: DeployHost, input: CommandInput): ExitCode => refusal(host, input, true);

export const confirm = (host: DeployHost, input: CommandInput): ExitCode =>
  refusal(host, input, false);
