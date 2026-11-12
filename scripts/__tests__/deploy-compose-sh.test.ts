import { useDeployShell } from './deploy-shell';

describe('scripts: deploy/compose.sh', () => {
  const shell = useDeployShell();

  const composeStubs = `
    field() { case "$1" in compose.context) echo ctx ;; compose.project) echo vp ;; compose.file) echo f.yml ;; images.registry) echo reg ;; *) echo x ;; esac; }
    secrets_file() { echo secrets.env; }
    resolved_tag() { echo "$TAG"; }
    compose_health() { return 0; }
    docker() { echo "$VP_TAG" >> calls; [ "$VP_TAG" != broken ]; }
  `;

  describe('compose rollback', () => {
    it('goes back to current-tag after a failed deploy of an explicit --tag', () => {
      shell.write('.deploy/compose-vm/current-tag', 'good-2');
      shell.write('.deploy/compose-vm/previous-tag', 'good-1');

      const run = shell.sourced(`${composeStubs} preflight_all() { return 0; }
        TAG=broken; compose_deploy`);

      expect(run.status).toBe(1);
      expect(shell.read('calls').split('\n').at(-1)).toBe('good-2');
      expect(shell.read('.deploy/compose-vm/current-tag')).toBe('good-2');
      expect(shell.read('.deploy/compose-vm/previous-tag')).toBe('good-1');
    });

    it('has nothing to go back to after a failed first deploy', () => {
      const run = shell.sourced(`${composeStubs} preflight_all() { return 0; }
        TAG=broken; compose_deploy`);

      expect(run.status).toBe(1);
      expect(run.stderr).toContain('first deploy');
    });

    it('refuses clearly when no previous tag is recorded, and never redeploys the broken tag', () => {
      const run = shell.sourced(`${composeStubs} TAG=broken; compose_rollback_to_previous`);

      expect(run.status).toBe(1);
      expect(run.stderr).toContain('no previous tag is recorded');
      expect(shell.readOr('calls', '')).toBe('');
    });

    it('rolls a manual rollback to the TAG override and keeps the tag history coherent', () => {
      shell.write('.deploy/compose-vm/current-tag', 'good-2');
      shell.write('.deploy/compose-vm/previous-tag', 'good-1');

      const run = shell.sourced(`${composeStubs} compose_rollback_to_previous good-0`);

      expect(run.status).toBe(0);
      expect(shell.read('.deploy/compose-vm/current-tag')).toBe('good-0');
      expect(shell.read('.deploy/compose-vm/previous-tag')).toBe('good-2');
    });

    it('records a successful deploy as current-tag and the one before it as previous-tag', () => {
      shell.write('.deploy/compose-vm/current-tag', 'good-1');

      const run = shell.sourced(`${composeStubs} preflight_all() { return 0; }
        TAG=good-2; compose_deploy`);

      expect(run.status).toBe(0);
      expect(shell.read('.deploy/compose-vm/current-tag')).toBe('good-2');
      expect(shell.read('.deploy/compose-vm/previous-tag')).toBe('good-1');
    });
  });

  describe('dc', () => {
    it('runs docker compose against the declared context, file and project', () => {
      const run = shell.sourced(`${composeStubs}
        docker() { echo "$*"; }
        dc ps`);

      expect(run.stdout.trim()).toBe('--context ctx compose -f f.yml -p vp ps');
    });

    it('adds the secrets file only when it exists', () => {
      shell.write('secrets.env', 'A=1');

      const run = shell.sourced(`${composeStubs}
        docker() { echo "$*"; }
        dc ps`);

      expect(run.stdout.trim()).toBe(
        '--context ctx compose -f f.yml -p vp --env-file secrets.env ps'
      );
    });
  });

  describe('compose_env', () => {
    it.each([
      { scenario: 'the resolved tag', args: '', expected: 'v1 reg' },
      { scenario: 'an explicit tag', args: 'v0', expected: 'v0 reg' },
    ])('exports $scenario and the registry', ({ args, expected }) => {
      const run = shell.sourced(
        `${composeStubs} TAG=v1; compose_env ${args}; echo "$VP_TAG $VP_REGISTRY"`
      );

      expect(run.stdout.trim()).toBe(expected);
    });
  });

  describe('compose_rollback', () => {
    it('is a dry run that names the tag it would redeploy', () => {
      shell.write('.deploy/compose-vm/previous-tag', 'good-1');

      const run = shell.sourced(`${composeStubs} DRY_RUN=1; compose_rollback`);

      expect(run.status).toBe(0);
      expect(run.stdout).toContain('rolling back to good-1');
      expect(run.stdout).toContain('[dry-run] docker --context ctx compose');
    });
  });
});
