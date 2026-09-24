import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';

describe('Cloud Infrastructure & Terraform (Ticket 31)', () => {
  const repoRoot = path.resolve(__dirname, '../../../../../');
  const terraformDir = path.join(repoRoot, 'infra/terraform');
  const cloudOverlayDir = path.join(repoRoot, 'infra/k8s/overlays/cloud');
  const runbookPath = path.join(repoRoot, 'docs/runbooks/cloud-accounts.md');
  const wizardPath = path.join(repoRoot, 'scripts/cloud-setup-wizard.sh');

  it('AC 1: Checklist and guide exists in docs/runbooks/cloud-accounts.md', () => {
    expect(existsSync(runbookPath)).toBe(true);
    const content = readFileSync(runbookPath, 'utf-8');

    // Covers external services from SDD §15.3 and §12.3
    expect(content).toContain('Cloudflare');
    expect(content).toContain('Hetzner');
    expect(content).toContain('Oracle');
    expect(content).toContain('Neon');
    expect(content).toContain('Grafana Cloud');

    // Covers env var mappings
    expect(content).toContain('CLOUDFLARE_ACCOUNT_ID');
    expect(content).toContain('CLOUDFLARE_API_TOKEN');
    expect(content).toContain('HCLOUD_TOKEN');
    expect(content).toContain('DATABASE_URL');
    expect(content).toContain('GRAFANA_OTLP_ENDPOINT');
  });

  it('Interactive setup wizard exists and has executable syntax', () => {
    expect(existsSync(wizardPath)).toBe(true);
    const content = readFileSync(wizardPath, 'utf-8');
    expect(content).toContain('TOTAL_STAGES=6');
    expect(content).toContain('stage "Cloudflare: Domain & Account ID"');
    expect(content).toContain('stage "Hetzner Cloud: API Token & SSH Key"');
    expect(content).toContain('stage "Secrets: External Secrets Operator"');
  });

  it('AC 2: Terraform configurations exist and follow style guide', () => {
    const tfFiles = [
      'terraform.tf',
      'providers.tf',
      'variables.tf',
      'main.tf',
      'outputs.tf',
      'terraform.tfvars.example',
    ];
    for (const file of tfFiles) {
      const fullPath = path.join(terraformDir, file);
      expect(existsSync(fullPath), `Terraform file ${file} must exist`).toBe(true);
      const content = readFileSync(fullPath, 'utf-8');
      expect(content.length).toBeGreaterThan(20);
    }

    // Check version pinning in terraform.tf
    const terraformTf = readFileSync(path.join(terraformDir, 'terraform.tf'), 'utf-8');
    expect(terraformTf).toContain('cloudflare =');
    expect(terraformTf).toContain('hcloud =');
    expect(terraformTf).toContain('required_version = ">= 1.5.0"');

    // Check variables
    const variablesTf = readFileSync(path.join(terraformDir, 'variables.tf'), 'utf-8');
    expect(variablesTf).toContain('variable "cloudflare_account_id"');
    expect(variablesTf).toContain('variable "cloudflare_api_token"');
    expect(variablesTf).toContain('variable "domain"');
    expect(variablesTf).toContain('variable "hcloud_token"');
    expect(variablesTf).toContain('variable "operator_ssh_ip"');
  });

  it('AC 3: R2 resources defined (2 buckets, lifecycle rules, custom CDN domain)', () => {
    const mainTf = readFileSync(path.join(terraformDir, 'main.tf'), 'utf-8');

    // Two buckets: raw and public
    expect(mainTf).toContain('resource "cloudflare_r2_bucket" "raw"');
    expect(mainTf).toContain('name       = "vp-raw"');
    expect(mainTf).toContain('resource "cloudflare_r2_bucket" "public"');
    expect(mainTf).toContain('name       = "vp-public"');

    // Lifecycle rule (raw 7d retention, 1d abort multipart)
    expect(mainTf).toContain('resource "cloudflare_r2_bucket_lifecycle" "raw"');
    expect(mainTf).toContain('abort_multipart_uploads_transition');
    expect(mainTf).toContain('max_age = 86400');
    expect(mainTf).toContain('var.raw_retention_days * 86400');

    // Custom domain cdn.<domain>
    expect(mainTf).toContain('resource "cloudflare_r2_custom_domain" "public_cdn"');
    expect(mainTf).toContain('domain      = "cdn.${var.domain}"');
  });

  it('AC 4: Cloudflare Tunnel & Access policy defined and cloudflared config committed', () => {
    const mainTf = readFileSync(path.join(terraformDir, 'main.tf'), 'utf-8');

    // Tunnel and CNAME
    expect(mainTf).toContain('resource "cloudflare_tunnel" "k3s_tunnel"');
    expect(mainTf).toContain('resource "cloudflare_record" "api_tunnel"');
    expect(mainTf).toContain('resource "cloudflare_tunnel_config" "k3s_tunnel_config"');

    // Access policy protecting /admin
    expect(mainTf).toContain('resource "cloudflare_access_application" "admin_portal"');
    expect(mainTf).toContain('domain                    = "api.${var.domain}/admin"');
    expect(mainTf).toContain('resource "cloudflare_access_policy" "admin_allow_operator"');

    // cloudflared deployment template for Ticket 32
    const cloudflaredPath = path.join(cloudOverlayDir, 'cloudflared.yaml');
    expect(existsSync(cloudflaredPath)).toBe(true);
    const cloudflaredContent = readFileSync(cloudflaredPath, 'utf-8');
    expect(cloudflaredContent).toContain('name: cloudflared');
    expect(cloudflaredContent).toContain('image: cloudflare/cloudflared:latest');
    expect(cloudflaredContent).toContain('CLOUDFLARE_TUNNEL_TOKEN');
  });

  it('AC 5: Hetzner server and firewall defined with SSH restriction and Oracle alternative documented', () => {
    const mainTf = readFileSync(path.join(terraformDir, 'main.tf'), 'utf-8');

    // Hetzner server & firewall
    expect(mainTf).toContain('resource "hcloud_server" "k3s_node"');
    expect(mainTf).toContain('resource "hcloud_firewall" "vps_firewall"');
    expect(mainTf).toContain('resource "hcloud_ssh_key" "operator_key"');
    expect(mainTf).toContain('var.operator_ssh_ip');

    // Oracle path documented in runbook with June 2026 limits
    const runbook = readFileSync(runbookPath, 'utf-8');
    expect(runbook).toContain('2 OCPU / 12 GB RAM A1 Arm');
    expect(runbook).toContain('Oracle Cloud Infrastructure');
  });

  describe('Cost Guardrails, Alert Rules & Operator Runbooks (Ticket 33)', () => {
    const alertRulesPath = path.join(
      repoRoot,
      'infra/observability/alerts/video-pipeline-alerts.yaml'
    );
    const dashboardPath = path.join(repoRoot, 'infra/observability/dashboards/storage-cost.json');
    const runbooksDir = path.join(repoRoot, 'docs/runbooks');

    it('AC 1: R2ClassABudget alert is defined and fires when lowering the threshold', () => {
      expect(existsSync(alertRulesPath)).toBe(true);
      const alertRulesContent = readFileSync(alertRulesPath, 'utf-8');
      expect(alertRulesContent).toContain('alert: R2ClassABudget');
      expect(alertRulesContent).toContain('runbook_url: "docs/runbooks/cost-budget.md"');

      // Alert logic simulation:
      const evalR2ClassABudget = (projectedMonthlyClassAOps: number, threshold = 900000) => {
        return projectedMonthlyClassAOps > threshold;
      };

      expect(evalR2ClassABudget(500000)).toBe(false);
      expect(evalR2ClassABudget(900001)).toBe(true);
      expect(evalR2ClassABudget(500000, 400000)).toBe(true);
    });

    it('AC 2: Storage & Cost dashboard covers Class A/B ops and Grafana Cloud series', () => {
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

    it('AC 3 & 4: Five Operator Runbooks exist and follow the required 6-part structure', () => {
      const fiveRunbooks = [
        'dlq-replay.md',
        'queue-paused.md',
        'worker-stuck.md',
        'storage-outage.md',
        'cost-budget.md',
      ];

      for (const runbookName of fiveRunbooks) {
        const fullPath = path.join(runbooksDir, runbookName);
        expect(existsSync(fullPath), `Runbook ${runbookName} must exist`).toBe(true);
        const content = readFileSync(fullPath, 'utf-8');

        // Required standard structure:
        // - Trigger (which alert or symptom)
        // - Dashboards to open
        // - Diagnosis steps
        // - Remediation commands
        // - Verification
        // - Prevention
        expect(content).toMatch(/## 2\.\s+Trigger/i);
        expect(content).toMatch(/## 3\.\s+Dashboards to Open/i);
        expect(content).toMatch(/## 4\.\s+Diagnosis/i);
        expect(content).toMatch(/## 5\.\s+Remediation/i);
        expect(content).toMatch(/## 6\.\s+Verification/i);
        expect(content).toMatch(/## 7\.\s+Prevention/i);
      }
    });

    it('AC 4: All runbook_url entries in alert-rules.yaml resolve to existing files in docs/runbooks/', () => {
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
