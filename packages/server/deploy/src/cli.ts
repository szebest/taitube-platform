import { parseArgs } from 'node:util';
import { tryCatch } from '@vp/result';
import {
  type CommandInput,
  confirm,
  gate,
  get,
  list,
  namespace,
  render,
  secretsCheck,
  tag,
  validate,
  vars,
} from './environment-commands';
import { EXIT, type ExitCode } from './exit-codes';
import type { DeployHost } from './host';
import { expired, migrationsCheck, slug } from './maintenance-commands';

const DEFAULT_BASE = 'origin/main';

/** @internal Exported for its spec. */
export const USAGE = `pnpm envctl <command> [environment] [options]    (the typed half of scripts/deploy.sh)

  list                        every environment, its kind and what it is for
  validate                    every environment file against the spec and the env schema
  get <env> <path>            one field, e.g. cluster.context or health.smoke
  vars <env>                  every field as E_<path>='value' lines a shell can eval
  namespace <env>             the namespace, with --slug <branch or PR> for a preview
  render <env>                write .deploy/<env>/ (kustomization.yaml and quota.yaml) and print its path
  secrets-check <env>         which expected secrets .secrets/<env>.env lacks, names only
  tag <env>                   the image tag a deploy uses, {sha} resolved against HEAD
  gate <env>                  refuse a context the environment does not declare, a floating tag or an unconfirmed protected one
  confirm <env>               the same without the tag rule: for a rollback, which pins nothing
  migrations-check            migration files may only be added against --base (default ${DEFAULT_BASE})
  preview-slug <ref>          a branch or PR as a preview slug
  expired-previews            namespaces past their expiry, from kubectl's JSON on stdin

  --slug <ref>  --tag <image tag>  --file <path>  --context <name>  --yes  --confirm <env>  --base <ref>

Exit codes: 0 ok, 1 failure, 2 usage, 3 prerequisite missing.`;

function parse(argv: readonly string[]) {
  return tryCatch(
    () =>
      parseArgs({
        args: [...argv],
        allowPositionals: true,
        options: {
          slug: { type: 'string' },
          tag: { type: 'string' },
          file: { type: 'string' },
          context: { type: 'string' },
          confirm: { type: 'string' },
          base: { type: 'string', default: DEFAULT_BASE },
          yes: { type: 'boolean', default: false },
          help: { type: 'boolean', short: 'h', default: false },
        },
      }),
    (cause) =>
      String(cause)
        .replace(/^\w*Error\b[^:]*: /, '')
        .split('. ')[0] ?? String(cause)
  );
}

export function run(argv: readonly string[], host: DeployHost): ExitCode {
  const parsed = parse(argv);
  if (!parsed.ok) {
    host.print(`${parsed.error}. See pnpm envctl --help.`);
    return EXIT.usage;
  }
  const { values, positionals } = parsed.value;
  const [command, environment, ...rest] = positionals;
  const input: CommandInput = {
    environment,
    rest,
    slug: values.slug,
    tag: values.tag,
    file: values.file,
    context: values.context,
    yes: values.yes,
    confirm: values.confirm,
  };

  switch (values.help ? 'help' : command) {
    case 'list':
      return list(host);
    case 'validate':
      return validate(host);
    case 'get':
      return get(host, input);
    case 'vars':
      return vars(host, input);
    case 'namespace':
      return namespace(host, input);
    case 'render':
      return render(host, input);
    case 'secrets-check':
      return secretsCheck(host, input);
    case 'tag':
      return tag(host, input);
    case 'gate':
      return gate(host, input);
    case 'confirm':
      return confirm(host, input);
    case 'migrations-check':
      return migrationsCheck(host, values.base);
    case 'preview-slug':
      return slug(host, environment);
    case 'expired-previews':
      return expired(host);
    case 'help':
      host.print(USAGE);
      return EXIT.ok;
    default:
      host.print(USAGE);
      return EXIT.usage;
  }
}
