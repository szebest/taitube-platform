import * as fs from 'node:fs';
import * as path from 'node:path';
import { load } from 'js-yaml';
import { z } from 'zod';

const AlertRule = z.object({
  alert: z.string(),
  expr: z.string(),
  for: z.string(),
  labels: z.object({ severity: z.string(), environment: z.string().optional() }),
  annotations: z.object({
    summary: z.string().optional(),
    description: z.string().optional(),
    runbook_url: z.string().optional(),
  }),
});

const AlertRulesFile = z.object({
  groups: z.array(z.object({ rules: z.array(AlertRule) })),
});

export type AlertRule = z.infer<typeof AlertRule>;

export const rootDir = path.resolve(__dirname, '../../../../../');
export const alertRulesPath = path.resolve(
  rootDir,
  'infra/observability/alerts/video-pipeline-alerts.yaml'
);
export const alertmanagerPath = path.resolve(
  rootDir,
  'infra/compose/alertmanager/alertmanager.yml'
);

export function loadAlertRules(): AlertRule[] {
  const file = AlertRulesFile.parse(load(fs.readFileSync(alertRulesPath, 'utf-8')));
  return file.groups.flatMap((group) => group.rules);
}
