import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DEPLOY_DIR, useDeployShell } from './deploy-shell';

const COMMAND_POSITION =
  /(^|[|;&(]|\$\(|\b(?:run|show|then|do|else|elif|if|!)\b)\s*(kubectl|helm)\s/;
const WRAPPERS = /^(kc|hc|kube_current_context)\(\)/;

describe('scripts: deploy/common.sh', () => {
  const shell = useDeployShell();
  const stubs = `field() { case "$1" in cluster.context) echo k3s-x ;; *) echo x ;; esac; }`;

  describe('kc and hc', () => {
    it.each([
      { wrapper: 'kc -n vp get pods', expected: 'kubectl --context k3s-x -n vp get pods' },
      {
        wrapper: 'hc upgrade --install r c',
        expected: 'helm --kube-context k3s-x upgrade --install r c',
      },
    ])('runs "$wrapper" against the declared cluster', ({ wrapper, expected }) => {
      const run = shell.sourced(`${stubs}
        kubectl() { echo "kubectl $*"; }; helm() { echo "helm $*"; }
        ${wrapper}`);

      expect(run.stdout.trim()).toBe(expected);
    });

    it('is not fooled by the current context, which only the gate reads', () => {
      const run = shell.sourced(`${stubs}
        kubectl() { echo "kubectl $*"; }
        kube_current_context; kc get ns`);

      expect(run.stdout).toContain('kubectl config current-context');
      expect(run.stdout).toContain('kubectl --context k3s-x get ns');
    });
  });

  describe('run', () => {
    it.each([
      { command: 'kc -n vp get pods', expected: 'kubectl --context k3s-x -n vp get pods' },
      { command: 'hc repo add a b', expected: 'helm --kube-context k3s-x repo add a b' },
      { command: 'docker build .', expected: 'docker build .' },
    ])('prints "$expected" under a dry run and executes nothing', ({ command, expected }) => {
      const run = shell.sourced(`${stubs}; DRY_RUN=1; kubectl() { echo EXEC; }; run ${command}`);

      expect(run.stdout).toContain(`[dry-run] ${expected}`);
      expect(run.stdout).not.toContain('EXEC');
    });

    it('executes the command otherwise', () => {
      const run = shell.sourced(`run echo ran`);

      expect(run.stdout.trim()).toBe('ran');
    });
  });

  describe('kustomize_build', () => {
    it('falls back to kubectl kustomize, on the declared context, without kustomize', () => {
      const run = shell.sourced(`${stubs}
        have() { return 1; }; kubectl() { echo "kubectl $*"; }
        kustomize_build dir`);

      expect(run.stdout.trim()).toBe('kubectl --context k3s-x kustomize dir');
    });
  });

  describe('confirm_flags', () => {
    it.each([
      { vars: 'YES=1', expected: '--yes' },
      { vars: 'CONFIRM=production', expected: '--confirm production' },
      { vars: 'YES=1 CONFIRM=production', expected: '--yes --confirm production' },
      { vars: 'true', expected: '' },
    ])('passes $vars as "$expected"', ({ vars, expected }) => {
      const run = shell.sourced(`${vars}; confirm_flags`);

      expect(run.stdout.trim()).toBe(expected);
    });
  });

  describe('field', () => {
    it('reads the variable load_environment wrote for a dotted path', () => {
      const run = shell.sourced(`E_cluster_context=k3s-x; field cluster.context`);

      expect(run.stdout).toBe('k3s-x');
    });
  });

  describe('need_tool', () => {
    it.each([
      { scenario: 'a missing tool', setup: 'true', shown: 'FAIL' },
      {
        scenario: 'a missing runtime tool under a dry run',
        setup: 'DRY_RUN=1',
        shown: 'warn',
      },
    ])('reports $scenario', ({ setup, shown }) => {
      const run = shell.sourced(`${setup}; have() { return 1; }; MISSING=0
        need_tool nothing${setup === 'true' ? '' : ' runtime'}; echo "missing=$MISSING"`);

      expect(run.stdout + run.stderr).toContain(shown);
      expect(run.stdout).toContain(setup === 'true' ? 'missing=1' : 'missing=0');
    });
  });

  it('names kubectl and helm as commands in no deploy module but through kc and hc', () => {
    const offenders = readdirSync(DEPLOY_DIR)
      .filter((file) => file.endsWith('.sh'))
      .flatMap((file) =>
        readFileSync(join(DEPLOY_DIR, file), 'utf8')
          .split('\n')
          .filter((line) => !WRAPPERS.test(line) && COMMAND_POSITION.test(line))
          .map((line) => `${file}: ${line.trim()}`)
      );

    expect(offenders).toEqual([]);
  });

  it('would catch a bare kubectl or helm', () => {
    expect(
      [
        '  run kubectl get ns',
        '  x | kubectl apply -f -',
        'out="$(helm list)"; helm repo add',
      ].filter((line) => COMMAND_POSITION.test(line))
    ).toHaveLength(3);
  });
});
