import { useDeployShell } from './deploy-shell';

describe('scripts: deploy/k8s.sh', () => {
  const shell = useDeployShell();

  describe('k8s_deploy preflight order', () => {
    const checkStubs = `
      for c in check_tools check_spec check_gate check_secrets check_images check_migrations check_manifests check_terraform check_cluster; do
        eval "$c() { echo $c >> trace; }"
      done
      bootstrap_cluster() { echo bootstrap_cluster >> trace; }
      field() { case "$1" in kind) echo "$KIND" ;; *) echo x ;; esac; }
      ensure_dev_secrets() { :; }; helm_backing() { :; }; build_images() { :; }
      apply_manifest() { :; }; wait_rollout() { :; }; health_gate() { :; }
      resolved_tag() { echo t; }; ns() { echo vp; }; kubectl() { :; }
    `;

    const trace = () => shell.read('trace').split('\n');

    it('creates a k3d cluster before the checks that need one', () => {
      const run = shell.sourced(`${checkStubs} KIND=k3d; k8s_deploy`);

      expect(run.status).toBe(0);
      const order = trace();
      expect(order.slice(0, 2)).toEqual(['check_tools', 'bootstrap_cluster']);
      expect(order.indexOf('bootstrap_cluster')).toBeLessThan(order.indexOf('check_gate'));
      expect(order.indexOf('bootstrap_cluster')).toBeLessThan(order.indexOf('check_cluster'));
      expect(order.filter((name) => name === 'check_tools')).toHaveLength(1);
    });

    it('keeps preflight before the bootstrap for every other kind of cluster', () => {
      const run = shell.sourced(`${checkStubs} KIND=k3s; k8s_deploy`);

      expect(run.status).toBe(0);
      expect(trace().at(-1)).toBe('bootstrap_cluster');
      expect(trace()[0]).toBe('check_tools');
    });

    it('does not bootstrap when the tools are missing', () => {
      const run = shell.sourced(`${checkStubs} check_tools() { return 3; }; KIND=k3d; k8s_deploy`);

      expect(run.status).toBe(3);
      expect(shell.readOr('trace', '')).toBe('');
    });
  });

  describe('a failed k8s_deploy', () => {
    const kubectlStub = `
      ns() { echo vp; }
      kubectl() {
        case "$*" in
          *go-template*) cat revs ;;
          *"-o name"*) printf 'deployment.apps/vp-api\\ndeployment.apps/vp-web\\ndeployment.apps/vp-studio\\n' ;;
          *"rollout undo"*) echo "$*" >> undone ;;
          *) echo "$*" >> calls ;;
        esac
      }
    `;
    const deployStubs = `${kubectlStub}
      field() { case "$1" in cluster.context) echo k3s-x ;; *) echo x ;; esac; }
      ensure_dev_secrets() { :; }; preflight_all() { return 0; }
      bootstrap_cluster() { :; }; helm_backing() { :; }; build_images() { :; }; resolved_tag() { echo t; }
      wait_rollout() { :; }; health_gate() { :; }`;

    it('undoes only the deployments whose revision the failed apply changed', () => {
      shell.write('revs', 'vp-api=1\nvp-web=4\nvp-studio=2');

      const run = shell.sourced(`${deployStubs}
        apply_manifest() { printf 'vp-api=2\\nvp-web=4\\nvp-studio=2\\n' > revs; return 1; }
        k8s_deploy`);

      const undone = shell.readOr('undone', '');
      expect(run.status).toBe(1);
      expect(undone).toContain('deployment.apps/vp-api');
      expect(undone).not.toContain('vp-web');
      expect(undone).not.toContain('vp-studio');
    });

    it('sends every kubectl call to the context the environment declares', () => {
      shell.write('revs', 'vp-api=1');

      shell.sourced(`${deployStubs}
      apply_manifest() { return 1; }; k8s_deploy`);

      const calls = [shell.readOr('undone', ''), shell.readOr('calls', '')]
        .join('\n')
        .split('\n')
        .filter(Boolean);
      expect(calls.length).toBeGreaterThan(0);
      expect(calls.filter((call) => !call.startsWith('--context k3s-x '))).toEqual([]);
    });
  });

  describe('k8s_plan', () => {
    it('diffs against the declared context, not whichever is current', () => {
      const run = shell.sourced(`
        field() { case "$1" in cluster.context) echo k3s-x ;; *) echo x ;; esac; }
        static_checks() { return 0; }; resolved_tag() { echo t; }; ns() { echo vp; }
        manifest() { printf 'kind: Deployment\\n'; }
        kubectl() { echo "kubectl $*" >> calls; }
        k8s_plan`);

      expect(run.status).toBe(0);
      expect(shell.read('calls')).toContain('kubectl --context k3s-x diff -f -');
    });

    it('says the cluster is not reachable when it is not, and still succeeds', () => {
      const run = shell.sourced(`
        field() { case "$1" in cluster.context) echo k3s-x ;; *) echo x ;; esac; }
        static_checks() { return 0; }; resolved_tag() { echo t; }; ns() { echo vp; }
        manifest() { printf 'kind: Deployment\\n'; }
        kubectl() { return 1; }
        k8s_plan`);

      expect(run.status).toBe(0);
      expect(run.stdout).toContain('context k3s-x is not reachable from here');
    });
  });

  describe('manifest', () => {
    it.each([
      { mode: 'apply', expected: 'token=s3cret' },
      { mode: 'plan', expected: 'token=change-me-admin-token-local-cluster' },
    ])('puts the ADMIN_TOKEN in the $mode render only when it is applied', ({ mode, expected }) => {
      shell.write('.secrets/compose-vm.env', 'ADMIN_TOKEN=s3cret');

      const run = shell.sourced(`
        render_overlay() { echo dir; }
        kustomize_build() { echo token=change-me-admin-token-local-cluster; }
        manifest ${mode}`);

      expect(run.stdout.trim()).toBe(expected);
    });
  });

  describe('k8s_rollback', () => {
    it('asks for the confirmation and stops when it is refused', () => {
      const run = shell.sourced(`
        envctl() { echo refused; return 1; }; kube_current_context() { echo k3s-x; }
        rollback_deployments() { echo rolled; }
        k8s_rollback`);

      expect(run.status).toBe(1);
      expect(run.stdout).not.toContain('rolled');
    });

    it('skips the confirmation under --dry-run', () => {
      const run = shell.sourced(`
        envctl() { return 1; }; rollback_deployments() { echo rolled; }
        DRY_RUN=1; k8s_rollback`);

      expect(run.stdout).toContain('rolled');
    });
  });

  describe('k8s_logs and k8s_status', () => {
    it('name the declared context in what a dry run would execute', () => {
      const run = shell.sourced(`
        field() { case "$1" in cluster.context) echo k3s-x ;; *) echo x ;; esac; }
        ns() { echo vp; }; DRY_RUN=1; SERVICE=web; k8s_logs`);

      expect(run.stdout).toContain(
        '[dry-run] kubectl --context k3s-x -n vp logs deploy/vp-web --tail=200'
      );
    });
  });

  describe('k8s_expire', () => {
    it('lists nothing and deletes nothing when no preview has expired', () => {
      const run = shell.sourced(`
        envctl() { return 0; }; kubectl() { echo "kubectl $*" >> calls; }
        field() { echo k3s-x; }; kube_current_context() { echo k3s-x; }
        k8s_expire`);

      expect(run.status).toBe(0);
      expect(run.stdout).toContain('no preview has expired');
      expect(shell.read('calls')).not.toContain('delete');
    });
  });
});
