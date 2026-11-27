import { useDeployShell } from './deploy-shell';

describe('scripts: deploy/k8s-rollout.sh', () => {
  const shell = useDeployShell();

  const kubectlStub = `
    ns() { echo vp; }
    field() { case "$1" in cluster.context) echo k3s-x ;; *) echo x ;; esac; }
    kubectl() {
      case "$*" in
        *go-template*) cat revs ;;
        *"-o name"*) printf 'deployment.apps/vp-api\\ndeployment.apps/vp-web\\ndeployment.apps/vp-studio\\n' ;;
        *"rollout undo"*) echo "$*" >> undone ;;
      esac
    }
  `;

  describe('rollback_deployments', () => {
    it('undoes nothing when the failure left every revision alone', () => {
      shell.write('revs', 'vp-api=3\nvp-web=4');

      const run = shell.sourced(
        `${kubectlStub} rollback_deployments changed $'vp-api=3\\nvp-web=4'`
      );

      expect(run.status).toBe(0);
      expect(shell.readOr('undone', '')).toBe('');
    });

    it('undoes every deployment on a manual rollback, each on the declared context', () => {
      shell.write('revs', 'vp-api=3\nvp-web=4');

      const run = shell.sourced(`${kubectlStub} rollback_deployments all`);

      const undone = shell.read('undone').split('\n');
      expect(run.status).toBe(0);
      expect(undone).toHaveLength(3);
      expect(undone.every((call) => call.startsWith('--context k3s-x -n vp rollout undo'))).toBe(
        true
      );
    });

    it('undoes a changed deployment and skips one that had no revision before the apply', () => {
      shell.write('revs', 'vp-api=2\nvp-web=5\nvp-studio=1');

      const run = shell.sourced(`${kubectlStub} rollback_deployments changed 'vp-web=4'`);

      expect(run.status).toBe(0);
      expect(shell.read('undone')).toBe(
        '--context k3s-x -n vp rollout undo deployment.apps/vp-web'
      );
    });

    it('names what a dry run would undo without calling the cluster', () => {
      const run = shell.sourced(`${kubectlStub} DRY_RUN=1; rollback_deployments changed ""`);

      expect(run.stdout).toContain(
        'rollout undo each deployment labelled vp.dev/environment=compose-vm whose revision the apply changed'
      );
      expect(shell.readOr('undone', '')).toBe('');
    });
  });

  describe('revision_of', () => {
    it.each([
      { name: 'vp-api', expected: '2' },
      { name: 'vp-web', expected: '' },
      { name: 'vp', expected: '' },
    ])('reads $name from a list of name=revision lines as "$expected"', ({ name, expected }) => {
      const run = shell.sourced(`revision_of $'vp-api=2\\nvp-studio=7' ${name}`);

      expect(run.stdout.trim()).toBe(expected);
    });
  });

  describe('deployment_revisions', () => {
    it('lists the environment label selector on the declared context', () => {
      const run = shell.sourced(`${kubectlStub}
        kubectl() { echo "$*"; }
        deployment_revisions`);

      expect(run.stdout).toContain(
        '--context k3s-x -n vp get deploy -l vp.dev/environment=compose-vm'
      );
    });
  });

  describe('apply_manifest', () => {
    it('names the declared context in the dry run and applies nothing', () => {
      const run = shell.sourced(
        `${kubectlStub} state_dir() { echo .deploy/x; }; DRY_RUN=1; apply_manifest`
      );

      expect(run.stdout).toContain(
        'apply the kustomize build of .deploy/x to namespace vp with kubectl --context k3s-x'
      );
    });

    it('pipes the apply render into kubectl on the declared context', () => {
      const run = shell.sourced(`${kubectlStub}
        manifest() { echo "$1: manifest"; }
        kubectl() { echo "$*"; cat; }
        apply_manifest`);

      expect(run.stdout).toContain('--context k3s-x apply -f -');
      expect(run.stdout).toContain('apply: manifest');
    });
  });

  describe('wait_rollout', () => {
    it('fails with the migration job log when the job does not complete', () => {
      const run = shell.sourced(`${kubectlStub}
        kubectl() { case "$*" in *wait*) return 1 ;; *logs*) echo "log line" ;; esac; }
        wait_rollout`);

      expect(run.status).toBe(1);
      expect(run.stderr).toContain('the migration job did not complete');
      expect(run.stdout).toContain('log line');
    });
  });

  describe('health_gate', () => {
    it.each([
      { smoke: 'true', expected: 'bash scripts/e2e-smoke.sh against the API' },
      { smoke: 'false', expected: 'GET /readyz until it answers 200' },
    ])('under a dry run with smoke $smoke says "$expected"', ({ smoke, expected }) => {
      const run = shell.sourced(`
        field() { case "$1" in health.smoke) echo ${smoke} ;; health.readyzTimeoutSec) echo 30 ;; *) echo x ;; esac; }
        ns() { echo vp; }; DRY_RUN=1; health_gate`);

      expect(run.status).toBe(0);
      expect(run.stdout).toContain(expected);
      expect(run.stdout.includes('e2e-smoke')).toBe(smoke === 'true');
    });
  });

  describe('api_url', () => {
    it.each([
      { kind: 'k3d', expected: 'http://localhost:3000' },
      { kind: 'k3s', expected: 'http://127.0.0.1:2222' },
    ])('is $expected for $kind', ({ kind, expected }) => {
      const run = shell.sourced(`PF_PORT=2222; field() { echo ${kind}; }; api_url`);

      expect(run.stdout.trim()).toBe(expected);
    });
  });
});
