import { useDeployShell } from './deploy-shell';

describe('scripts: deploy/preflight.sh', () => {
  const shell = useDeployShell();

  const stubs = `
    field() { case "$1" in
      secrets.source) echo "$SOURCE" ;; secrets.keys) echo "A_KEY B_KEY" ;; kind) echo "$KIND" ;;
      cluster.context) echo k3s-x ;; production) echo true ;; *) echo x ;; esac; }
    ns() { echo vp; }
  `;

  describe('check_secrets', () => {
    it('reads names from the cluster for external secrets and never asks for the file', () => {
      const run = shell.sourced(`${stubs} SOURCE=external-secrets
        envctl() { echo "envctl $*" >> calls; }
        kubectl() { printf 'A_KEY\\nB_KEY\\n'; }
        check_secrets`);

      expect(run.status).toBe(0);
      expect(run.stdout).toContain('vp-secrets holds every expected key');
      expect(shell.readOr('calls', '')).toBe('');
    });

    it('names the keys the cluster lacks and fails, printing no value', () => {
      const run = shell.sourced(`${stubs} SOURCE=external-secrets
        kubectl() { printf 'A_KEY\\n'; }
        check_secrets`);

      expect(run.status).toBe(1);
      expect(run.stderr).toContain('vp-secrets lacks: B_KEY');
    });

    it('warns instead of failing when the namespace has no vp-secrets yet', () => {
      const run = shell.sourced(`${stubs} SOURCE=external-secrets
        kubectl() { return 1; }
        check_secrets`);

      expect(run.status).toBe(0);
      expect(run.stdout).toContain('Secret vp-secrets is not in vp yet');
    });

    it('reads the secret names through the declared context', () => {
      shell.sourced(`${stubs} SOURCE=external-secrets
        kubectl() { echo "$*" >> calls; printf 'A_KEY\\nB_KEY\\n'; }
        check_secrets`);

      expect(shell.read('calls')).toContain('--context k3s-x -n vp get secret vp-secrets');
    });

    it('names what a dry run would compare', () => {
      const run = shell.sourced(`${stubs} SOURCE=external-secrets; DRY_RUN=1; check_secrets`);

      expect(run.stdout).toContain(
        'compare the keys of Secret vp-secrets with secrets.keys, printing names only'
      );
    });

    it('checks the secrets file by name for an env-file environment', () => {
      const run = shell.sourced(`${stubs} SOURCE=env-file
        envctl() { echo "envctl $*"; return 1; }
        check_secrets`);

      expect(run.status).toBe(1);
      expect(run.stdout).toContain('envctl secrets-check compose-vm');
    });

    it('only warns under a dry run when the file lacks secrets', () => {
      const run = shell.sourced(`${stubs} SOURCE=env-file; DRY_RUN=1
        envctl() { return 1; }
        check_secrets`);

      expect(run.status).toBe(0);
      expect(run.stdout).toContain(
        'a real run stops here until the secrets are in .secrets/compose-vm.env'
      );
    });
  });

  describe('check_manifests', () => {
    it('validates only the environment being deployed', () => {
      const run = shell.sourced(`${stubs} KIND=k3s
        render_overlay() { echo .deploy/compose-vm; }; kustomize_build() { :; }
        bash() { echo "bash $*" >> calls; }
        check_manifests`);

      expect(run.status).toBe(0);
      expect(shell.read('calls')).toBe('bash scripts/validate-k8s.sh compose-vm');
    });
  });

  describe('check_cluster', () => {
    it('looks for each CRD through the declared context and names the missing one', () => {
      const run = shell.sourced(`${stubs} SOURCE=external-secrets; KIND=k3s
        kubectl() { echo "$*" >> calls; [ "$5" != externalsecrets.external-secrets.io ]; }
        check_cluster`);

      expect(run.status).toBe(1);
      expect(run.stderr).toContain('externalsecrets.external-secrets.io is not installed');
      expect(
        shell
          .read('calls')
          .split('\n')
          .every((call) => call.startsWith('--context k3s-x get crd'))
      ).toBe(true);
    });

    it('asks a compose environment for nothing', () => {
      const run = shell.sourced(`${stubs} KIND=compose; check_cluster`);

      expect(run.stdout).toBe('');
    });
  });

  describe('current_context', () => {
    it.each([
      { kind: 'k3s', expected: 'kube-now' },
      { kind: 'compose', expected: 'docker-now' },
    ])('asks $expected for a $kind environment', ({ kind, expected }) => {
      const run = shell.sourced(`${stubs} KIND=${kind}
        kube_current_context() { echo kube-now; }; docker() { echo docker-now; }
        current_context`);

      expect(run.stdout.trim()).toBe(expected);
    });
  });

  describe('run_checks', () => {
    it('runs every check and answers the worst exit code', () => {
      const run = shell.sourced(`
        one() { echo one; return 1; }; two() { echo two; return 3; }; three() { echo three; return 0; }
        run_checks one two three`);

      expect(run.status).toBe(3);
      expect(run.stdout.split('\n').filter(Boolean)).toEqual(['one', 'two', 'three']);
    });
  });

  describe('check_gate', () => {
    it('names the refusal a dry run would make instead of asking envctl', () => {
      const run = shell.sourced(`${stubs} KIND=k3s; DRY_RUN=1
        kube_current_context() { echo other; }
        check_gate`);

      expect(run.stdout).toContain('refuse unless the current context (other) is k3s-x');
    });
  });
});
