import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { parse } from '@cdktf/hcl2json';

interface Terraform {
  terraform: {
    required_version: string;
    required_providers: Record<string, { source: string; version: string }>[];
  }[];
  variable: Record<string, unknown[]>;
  resource: Record<string, Record<string, Record<string, unknown>[]>>;
  provider: Record<string, { version: string; constraints: string }[]>;
}

async function terraformFile(dir: string, file: string): Promise<Terraform> {
  const {
    terraform = [],
    variable = {},
    resource = {},
    provider = {},
  } = await parse(file, readFileSync(path.join(dir, file), 'utf-8'));
  return { terraform, variable, resource, provider };
}

describe('cloud infrastructure and Terraform', () => {
  const repoRoot = path.resolve(__dirname, '../../../../../');
  const terraformDir = path.join(repoRoot, 'infra/terraform');
  const cloudOverlayDir = path.join(repoRoot, 'infra/k8s/overlays/cloud');
  const runbookPath = path.join(repoRoot, 'docs/runbooks/cloud-accounts.md');
  const wizardPath = path.join(repoRoot, 'scripts/cloud-setup-wizard.sh');

  it('documents the cloud accounts checklist in docs/runbooks/cloud-accounts.md', () => {
    expect(existsSync(runbookPath)).toBe(true);
    const content = readFileSync(runbookPath, 'utf-8');

    expect(content).toContain('Cloudflare');
    expect(content).toContain('Hetzner');
    expect(content).toContain('Oracle');
    expect(content).toContain('Neon');
    expect(content).toContain('Grafana Cloud');

    expect(content).toContain('CLOUDFLARE_ACCOUNT_ID');
    expect(content).toContain('CLOUDFLARE_API_TOKEN');
    expect(content).toContain('HCLOUD_TOKEN');
    expect(content).toContain('DATABASE_URL');
    expect(content).toContain('GRAFANA_OTLP_ENDPOINT');
  });

  it('ships the interactive setup wizard with all its stages', () => {
    expect(existsSync(wizardPath)).toBe(true);
    const content = readFileSync(wizardPath, 'utf-8');
    expect(content).toContain('TOTAL_STAGES=6');
    expect(content).toContain('stage "Cloudflare: Domain & Account ID"');
    expect(content).toContain('stage "Hetzner Cloud: API Token & SSH Key"');
    expect(content).toContain('stage "Secrets: External Secrets Operator"');
  });

  it('pins the Cloudflare v5 provider by minor version and commits the lock file that selects it', async () => {
    const [settings] = (await terraformFile(terraformDir, 'terraform.tf')).terraform;
    const [providers] = settings?.required_providers ?? [];

    expect(settings?.required_version).toBe('>= 1.5.0');
    expect(providers?.cloudflare).toEqual({
      source: 'cloudflare/cloudflare',
      version: '~> 5.25.0',
    });
    expect(Object.keys(providers ?? {}).sort()).toEqual(['cloudflare', 'hcloud', 'random']);

    const { provider } = await terraformFile(terraformDir, '.terraform.lock.hcl');
    expect(provider['registry.terraform.io/cloudflare/cloudflare']?.[0]).toMatchObject({
      constraints: '~> 5.25.0',
      version: expect.stringMatching(/^5\.25\.\d+$/),
    });
  });

  it('declares the variables the wizard fills in', async () => {
    const { variable } = await terraformFile(terraformDir, 'variables.tf');

    expect(Object.keys(variable)).toEqual(
      expect.arrayContaining([
        'cloudflare_account_id',
        'cloudflare_api_token',
        'domain',
        'hcloud_token',
        'operator_ssh_ip',
      ])
    );
    expect(existsSync(path.join(terraformDir, 'terraform.tfvars.example'))).toBe(true);
  });

  it('declares every resource of the cloud rung, and nothing else', async () => {
    const { resource } = await terraformFile(terraformDir, 'main.tf');
    const addresses = Object.entries(resource).flatMap(([type, named]) =>
      Object.keys(named).map((name) => `${type}.${name}`)
    );

    expect(addresses.sort()).toEqual([
      'cloudflare_api_token.r2_api_app',
      'cloudflare_api_token.r2_worker_app',
      'cloudflare_dns_record.api_tunnel',
      'cloudflare_r2_bucket.public',
      'cloudflare_r2_bucket.raw',
      'cloudflare_r2_bucket_lifecycle.raw',
      'cloudflare_r2_custom_domain.public_cdn',
      'cloudflare_zero_trust_access_application.admin_portal',
      'cloudflare_zero_trust_access_policy.admin_allow_operator',
      'cloudflare_zero_trust_tunnel_cloudflared.k3s_tunnel',
      'cloudflare_zero_trust_tunnel_cloudflared_config.k3s_tunnel',
      'hcloud_firewall.vps_firewall',
      'hcloud_server.k3s_node',
      'hcloud_ssh_key.operator_key',
      'random_bytes.tunnel_secret',
    ]);
  });

  it.each([
    {
      what: 'names the raw bucket vp-raw',
      address: 'cloudflare_r2_bucket.raw',
      holds: { name: 'vp-raw' },
    },
    {
      what: 'names the public bucket vp-public',
      address: 'cloudflare_r2_bucket.public',
      holds: { name: 'vp-public' },
    },
    {
      what: 'serves the public bucket at cdn.<domain>',
      address: 'cloudflare_r2_custom_domain.public_cdn',
      holds: { domain: 'cdn.${var.domain}' },
    },
    {
      what: 'aborts raw multipart uploads after a day and expires raw objects after the retention',
      address: 'cloudflare_r2_bucket_lifecycle.raw',
      holds: {
        rules: [
          expect.objectContaining({
            abort_multipart_uploads_transition: { condition: { type: 'Age', max_age: 86400 } },
            delete_objects_transition: {
              condition: { type: 'Age', max_age: '${var.raw_retention_days * 86400}' },
            },
          }),
        ],
      },
    },
    {
      what: 'puts Access in front of api.<domain>/admin, with the operator policy attached',
      address: 'cloudflare_zero_trust_access_application.admin_portal',
      holds: {
        domain: 'api.${var.domain}/admin',
        policies: [
          { id: '${cloudflare_zero_trust_access_policy.admin_allow_operator.id}', precedence: 1 },
        ],
      },
    },
    {
      what: 'opens inbound SSH to the operator IP only',
      address: 'hcloud_firewall.vps_firewall',
      holds: {
        rule: expect.arrayContaining([
          expect.objectContaining({ direction: 'in', source_ips: ['${var.operator_ssh_ip}'] }),
        ]),
      },
    },
  ])('$what', async ({ address, holds }) => {
    const [type = '', name = ''] = address.split('.');
    const { resource } = await terraformFile(terraformDir, 'main.tf');

    expect(resource[type]?.[name]?.[0]).toMatchObject(holds);
  });

  it('commits the cloudflared manifest the tunnel token runs', () => {
    const cloudflaredPath = path.join(cloudOverlayDir, 'cloudflared.yaml');
    expect(existsSync(cloudflaredPath)).toBe(true);
    const cloudflaredContent = readFileSync(cloudflaredPath, 'utf-8');
    expect(cloudflaredContent).toContain('name: cloudflared');
    expect(cloudflaredContent).toContain('image: cloudflare/cloudflared:latest');
    expect(cloudflaredContent).toContain('CLOUDFLARE_TUNNEL_TOKEN');
  });

  it('documents the Oracle alternative to the Hetzner node', () => {
    const runbook = readFileSync(runbookPath, 'utf-8');
    expect(runbook).toContain('2 OCPU / 12 GB RAM A1 Arm');
    expect(runbook).toContain('Oracle Cloud Infrastructure');
  });

  describe('cost guardrails, alert rules and operator runbooks', () => {
    const alertRulesPath = path.join(
      repoRoot,
      'infra/observability/alerts/video-pipeline-alerts.yaml'
    );
    const dashboardPath = path.join(repoRoot, 'infra/observability/dashboards/storage-cost.json');
    const runbooksDir = path.join(repoRoot, 'docs/runbooks');

    it('defines the R2ClassABudget alert with its runbook', () => {
      expect(existsSync(alertRulesPath)).toBe(true);
      const alertRulesContent = readFileSync(alertRulesPath, 'utf-8');
      expect(alertRulesContent).toContain('alert: R2ClassABudget');
      expect(alertRulesContent).toContain('runbook_url: "docs/runbooks/cost-budget.md"');
    });

    it('covers Class A/B ops and Grafana Cloud series on the Storage & Cost dashboard', () => {
      expect(existsSync(dashboardPath)).toBe(true);
      const dashboardJson = JSON.parse(readFileSync(dashboardPath, 'utf-8'));
      expect(dashboardJson.title).toBe('Storage & Cost');

      const panelTitles = dashboardJson.panels.map((p: { title?: string }) => p.title);
      expect(panelTitles).toContain('Class A & Class B Storage Ops per Hour');
      expect(panelTitles).toContain('Projected Monthly Class A Ops (R2 1M/mo Free Tier Budget)');
      expect(panelTitles).toContain(
        'Grafana Cloud Active Metric Series Count (10k Free Tier Budget)'
      );
    });

    it.each([
      'dlq-replay.md',
      'queue-paused.md',
      'worker-stuck.md',
      'storage-outage.md',
      'cost-budget.md',
    ])('has the operator runbook %s with the required six-part structure', (runbookName) => {
      const fullPath = path.join(runbooksDir, runbookName);
      expect(existsSync(fullPath), `Runbook ${runbookName} must exist`).toBe(true);
      const content = readFileSync(fullPath, 'utf-8');

      expect(content).toMatch(/## 2\.\s+Trigger/i);
      expect(content).toMatch(/## 3\.\s+Dashboards to Open/i);
      expect(content).toMatch(/## 4\.\s+Diagnosis/i);
      expect(content).toMatch(/## 5\.\s+Remediation/i);
      expect(content).toMatch(/## 6\.\s+Verification/i);
      expect(content).toMatch(/## 7\.\s+Prevention/i);
    });

    it('resolves every runbook_url in the alert rules to a file in docs/runbooks/', () => {
      const alertRulesContent = readFileSync(alertRulesPath, 'utf-8');
      const runbookMatches = alertRulesContent.matchAll(/runbook_url:\s*["']?([^"'\r\n]+)["']?/g);
      let count = 0;
      for (const match of runbookMatches) {
        count++;
        const relPath = match[1]?.trim() ?? '';
        expect(relPath.startsWith('docs/runbooks/')).toBe(true);
        const resolvedPath = path.resolve(repoRoot, relPath);
        expect(existsSync(resolvedPath), `Runbook file at ${resolvedPath} must exist`).toBe(true);
      }
      expect(count).toBeGreaterThanOrEqual(10);
    });
  });
});
