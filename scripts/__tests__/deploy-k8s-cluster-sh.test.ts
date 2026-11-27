import { useDeployShell } from './deploy-shell';

describe('scripts: deploy/k8s-cluster.sh', () => {
  const shell = useDeployShell();

  describe('ensure_dev_secrets', () => {
    const stubs = `field() { case "$1" in secrets.keys) echo "$KEYS" ;; *) echo x ;; esac; }`;

    it('writes a private file with a random ADMIN_TOKEN once', () => {
      shell.sourced(`${stubs}; KEYS="ADMIN_TOKEN"; ensure_dev_secrets`);
      const first = shell.read('.secrets/compose-vm.env');
      shell.sourced(`${stubs}; KEYS="ADMIN_TOKEN"; ensure_dev_secrets`);

      expect(first).toMatch(/^ADMIN_TOKEN=[0-9a-f]{64}$/);
      expect(shell.read('.secrets/compose-vm.env')).toBe(first);
    });

    it('keeps the token it already wrote', () => {
      shell.write('.secrets/compose-vm.env', 'ADMIN_TOKEN=kept');

      shell.sourced(`${stubs}; KEYS="ADMIN_TOKEN"; ensure_dev_secrets`);

      expect(shell.read('.secrets/compose-vm.env')).toBe('ADMIN_TOKEN=kept');
    });

    it.each([
      { scenario: 'an environment that expects no ADMIN_TOKEN', keys: 'DATABASE_URL', dry: 0 },
      { scenario: 'a dry run', keys: 'ADMIN_TOKEN', dry: 1 },
    ])('writes nothing for $scenario', ({ keys, dry }) => {
      shell.sourced(`${stubs}; KEYS="${keys}"; DRY_RUN=${dry}; ensure_dev_secrets`);

      expect(shell.readOr('.secrets/compose-vm.env', 'none')).toBe('none');
    });
  });

  describe('bootstrap_cluster', () => {
    const stubs = `
      field() { case "$1" in kind) echo "$KIND" ;; cluster.context) echo k3d-vp ;; *) echo x ;; esac; }
      make() { echo "make $*" >> calls; }
    `;

    it('creates the k3d cluster named by the context when it does not exist', () => {
      const run = shell.sourced(`${stubs} k3d() { return 0; }; KIND=k3d; bootstrap_cluster`);

      expect(run.status).toBe(0);
      expect(shell.read('calls')).toBe('make k3d-up CLUSTER_NAME=vp');
    });

    it('leaves an existing k3d cluster alone', () => {
      const run = shell.sourced(`${stubs} k3d() { echo "vp 1/1"; }; KIND=k3d; bootstrap_cluster`);

      expect(run.stdout).toContain('k3d cluster vp exists');
      expect(shell.readOr('calls', '')).toBe('');
    });

    it('only names the existing cluster of a k3s environment', () => {
      const run = shell.sourced(`${stubs} KIND=k3s; bootstrap_cluster`);

      expect(run.stdout).toContain('an existing cluster: context k3d-vp');
      expect(shell.readOr('calls', '')).toBe('');
    });
  });

  describe('helm_backing', () => {
    const stubs = `
      field() { case "$1" in cluster.backing) echo "$BACKING" ;; kind) echo "$KIND" ;; cluster.context) echo k3s-x ;; *) echo x ;; esac; }
      ns() { echo vp; }
    `;

    it('installs the three charts through the declared kube context', () => {
      const run = shell.sourced(`${stubs} BACKING=helm; KIND=k3s; DRY_RUN=1; helm_backing`);

      const installs = run.stdout.split('\n').filter((line) => line.includes('upgrade --install'));
      expect(installs).toHaveLength(3);
      expect(installs.every((line) => line.includes('helm --kube-context k3s-x upgrade'))).toBe(
        true
      );
    });

    it.each([
      { scenario: 'managed backing services', backing: 'managed', kind: 'k3s' },
      { scenario: 'a k3d cluster, which make k3d-up already filled', backing: 'helm', kind: 'k3d' },
    ])('installs nothing for $scenario', ({ backing, kind }) => {
      const run = shell.sourced(
        `${stubs} BACKING=${backing}; KIND=${kind}; DRY_RUN=1; helm_backing`
      );

      expect(run.stdout).toBe('');
    });
  });

  describe('build_images', () => {
    it('builds and imports into the k3d cluster named by the context', () => {
      const run = shell.sourced(`
        field() { case "$1" in images.source) echo build ;; kind) echo k3d ;; cluster.context) echo k3d-vp ;; *) echo x ;; esac; }
        DRY_RUN=1; build_images`);

      expect(run.stdout).toContain('docker buildx bake --load');
      expect(run.stdout).toContain(
        'k3d image import vp-api:local vp-worker:local vp-web:local vp-studio:local -c vp'
      );
    });

    it('builds nothing when the images come from a registry', () => {
      const run = shell.sourced(`field() { echo registry; }; DRY_RUN=1; build_images`);

      expect(run.stdout).toBe('');
    });
  });
});
