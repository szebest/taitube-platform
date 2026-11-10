import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const SCRIPT = resolve(import.meta.dirname, '../deploy.sh');
const MODULES = ['common', 'preflight', 'compose', 'k8s'].map((name) =>
  resolve(import.meta.dirname, `../deploy/${name}.sh`)
);

function deploy(...args: string[]) {
  return spawnSync('bash', [SCRIPT, ...args], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: process.env.HOME },
    timeout: 25_000,
  });
}

describe('scripts: deploy.sh', () => {
  it('prints its usage on --help and exits 0, naming every command and the exit codes', () => {
    const run = deploy('--help');

    expect(run.status).toBe(0);
    for (const command of [
      'plan',
      'deploy',
      'status',
      'rollback',
      'logs',
      'preflight',
      'secrets-check',
    ]) {
      expect(run.stdout).toContain(command);
    }
    expect(run.stdout).toContain('Exit codes: 0 ok, 1 failure, 2 usage, 3 prerequisite missing.');
  });

  it.each([
    { scenario: 'no command', args: [], message: 'scripts/deploy.sh <command>' },
    {
      scenario: 'an unknown command',
      args: ['launch', '--env', 'local'],
      message: 'unknown command launch',
    },
    {
      scenario: 'an unknown option',
      args: ['status', '--bogus'],
      message: 'unknown option --bogus',
    },
    {
      scenario: 'an option without its value',
      args: ['status', '--env'],
      message: '--env takes a value',
    },
    { scenario: 'no environment', args: ['status'], message: 'status needs --env <name>' },
    {
      scenario: 'an unknown environment',
      args: ['status', '--env', 'qa'],
      message: 'unknown environment qa; one of:',
    },
  ])('exits 2 for $scenario', ({ args, message }) => {
    const run = deploy(...args);

    expect(run.status).toBe(2);
    expect(run.stdout + run.stderr).toContain(message);
  });

  it('lists the environments', () => {
    const run = deploy('list');

    expect(run.status).toBe(0);
    expect(run.stdout.split('\n').map((line) => line.split('\t')[0])).toEqual(
      expect.arrayContaining(['local', 'preview', 'staging', 'production', 'compose-vm'])
    );
  });

  it('lists the secrets a production environment lacks, by name, and exits 1', () => {
    const run = deploy('secrets-check', '--env', 'production');

    expect(run.status).toBe(1);
    expect(run.stdout).toContain('missing: ');
    expect(run.stdout).toContain('DATABASE_URL');
    expect(run.stdout).not.toContain('\u001b');
  });
});

describe('scripts: deploy/*.sh functions', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'deploy-sh-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function sourced(body: string) {
    const preamble = [
      'ENV=compose-vm DRY_RUN=0 TAG="" SLUG="" YES=0 CONFIRM="" FOLLOW=0',
      ...MODULES.map((module) => `. ${module}`),
    ].join('\n');
    return spawnSync('bash', ['-c', `${preamble}\n${body}`], { cwd: dir, encoding: 'utf8' });
  }

  function writeState(name: string, value: string) {
    mkdirSync(join(dir, '.deploy/compose-vm'), { recursive: true });
    writeFileSync(join(dir, '.deploy/compose-vm', name), `${value}\n`);
  }

  function readState(name: string) {
    return readFileSync(join(dir, '.deploy/compose-vm', name), 'utf8').trim();
  }

  const composeStubs = `
    field() { case "$1" in compose.context) echo ctx ;; compose.project) echo vp ;; *) echo x ;; esac; }
    secrets_file() { echo secrets.env; }
    resolved_tag() { echo "$TAG"; }
    compose_health() { return 0; }
    docker() { echo "$VP_TAG" >> calls; [ "$VP_TAG" != broken ]; }
  `;

  describe('compose rollback', () => {
    it('goes back to current-tag after a failed deploy of an explicit --tag', () => {
      writeState('current-tag', 'good-2');
      writeState('previous-tag', 'good-1');

      const run = sourced(`${composeStubs} preflight_all() { return 0; }
        TAG=broken; compose_deploy`);

      expect(run.status).toBe(1);
      expect(readFileSync(join(dir, 'calls'), 'utf8').trim().split('\n').at(-1)).toBe('good-2');
      expect(readState('current-tag')).toBe('good-2');
      expect(readState('previous-tag')).toBe('good-1');
    });

    it('has nothing to go back to after a failed first deploy', () => {
      const run = sourced(`${composeStubs} preflight_all() { return 0; }
        TAG=broken; compose_deploy`);

      expect(run.status).toBe(1);
      expect(run.stderr).toContain('first deploy');
    });

    it('refuses clearly when no previous tag is recorded, and never redeploys the broken tag', () => {
      const run = sourced(`${composeStubs} TAG=broken; compose_rollback_to_previous`);

      expect(run.status).toBe(1);
      expect(run.stderr).toContain('no previous tag is recorded');
      expect(() => readFileSync(join(dir, 'calls'), 'utf8')).toThrow();
    });

    it('rolls a manual rollback to the TAG override and keeps the tag history coherent', () => {
      writeState('current-tag', 'good-2');
      writeState('previous-tag', 'good-1');

      const run = sourced(`${composeStubs} compose_rollback_to_previous good-0`);

      expect(run.status).toBe(0);
      expect(readState('current-tag')).toBe('good-0');
      expect(readState('previous-tag')).toBe('good-2');
    });
  });

  describe('k8s_deploy preflight order', () => {
    const checkStubs = `
      for c in check_tools check_spec check_gate check_secrets check_images check_migrations check_manifests check_terraform check_cluster; do
        eval "$c() { echo $c >> trace; }"
      done
      bootstrap_cluster() { echo bootstrap_cluster >> trace; }
      field() { case "$1" in kind) echo "$KIND" ;; *) echo x ;; esac; }
      ensure_dev_secrets() { :; }; helm_backing() { :; }; build_images() { :; }
      apply_manifest() { :; }; wait_rollout() { :; }; verify_secret_names() { :; }; health_gate() { :; }
      resolved_tag() { echo t; }; ns() { echo vp; }; kubectl() { :; }
    `;

    function trace() {
      return readFileSync(join(dir, 'trace'), 'utf8').trim().split('\n');
    }

    it('creates a k3d cluster before the checks that need one', () => {
      const run = sourced(`${checkStubs} KIND=k3d; k8s_deploy`);

      expect(run.status).toBe(0);
      const order = trace();
      expect(order.slice(0, 2)).toEqual(['check_tools', 'bootstrap_cluster']);
      expect(order.indexOf('bootstrap_cluster')).toBeLessThan(order.indexOf('check_gate'));
      expect(order.indexOf('bootstrap_cluster')).toBeLessThan(order.indexOf('check_cluster'));
      expect(order.filter((name) => name === 'check_tools')).toHaveLength(1);
    });

    it('keeps preflight before the bootstrap for every other kind of cluster', () => {
      const run = sourced(`${checkStubs} KIND=k3s; k8s_deploy`);

      expect(run.status).toBe(0);
      expect(trace().at(-1)).toBe('bootstrap_cluster');
      expect(trace()[0]).toBe('check_tools');
    });

    it('does not bootstrap when the tools are missing', () => {
      const run = sourced(`${checkStubs} check_tools() { return 3; }; KIND=k3d; k8s_deploy`);

      expect(run.status).toBe(3);
      expect(() => readFileSync(join(dir, 'trace'), 'utf8')).toThrow();
    });
  });

  describe('k8s rollback', () => {
    const kubectlStub = `
      ns() { echo vp; }
      kubectl() {
        case "$*" in
          *go-template*) cat revs ;;
          *"-o name"*) printf 'deployment.apps/vp-api\ndeployment.apps/vp-web\ndeployment.apps/vp-studio\n' ;;
          *"rollout undo"*) echo "$*" >> undone ;;
        esac
      }
    `;

    function undone() {
      try {
        return readFileSync(join(dir, 'undone'), 'utf8');
      } catch {
        return '';
      }
    }

    it('undoes only the deployments whose revision the failed apply changed', () => {
      writeFileSync(join(dir, 'revs'), 'vp-api=1\nvp-web=4\nvp-studio=2\n');
      const run = sourced(`${kubectlStub}
        field() { echo x; }; ensure_dev_secrets() { :; }; preflight_all() { return 0; }
        bootstrap_cluster() { :; }; helm_backing() { :; }; build_images() { :; }; resolved_tag() { echo t; }
        apply_manifest() { printf 'vp-api=2\nvp-web=4\nvp-studio=2\n' > revs; return 1; }
        k8s_deploy`);

      expect(run.status).toBe(1);
      expect(undone()).toContain('deployment.apps/vp-api');
      expect(undone()).not.toContain('vp-web');
      expect(undone()).not.toContain('vp-studio');
    });

    it('undoes nothing when the failure left every revision alone', () => {
      writeFileSync(join(dir, 'revs'), 'vp-api=3\nvp-web=4\n');
      const run = sourced(`${kubectlStub} rollback_deployments changed $'vp-api=3\nvp-web=4'`);

      expect(run.status).toBe(0);
      expect(undone()).toBe('');
    });

    it('undoes every deployment on a manual rollback', () => {
      writeFileSync(join(dir, 'revs'), 'vp-api=3\nvp-web=4\n');
      const run = sourced(`${kubectlStub} rollback_deployments all`);

      expect(run.status).toBe(0);
      expect(undone().trim().split('\n')).toHaveLength(3);
    });
  });
});
