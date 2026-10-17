import { MS_PER_SECOND } from '@vp/domain/time';
import { z } from 'zod';

const ManifestSchema = z.array(
  z.object({ url: z.string(), isRepresentativeRun: z.boolean(), jsonPath: z.string() })
);

const ReportSchema = z.object({
  categories: z.object({ performance: z.object({ score: z.number() }) }),
  audits: z.object({
    'largest-contentful-paint': z.object({ numericValue: z.number() }),
    'cumulative-layout-shift': z.object({ numericValue: z.number() }),
  }),
});

/** The reports `lhci upload --target=filesystem` lists in its manifest: one per URL it measured. */
export function representativeReports(manifest: unknown): { url: string; jsonPath: string }[] {
  return ManifestSchema.parse(manifest).filter(({ isRepresentativeRun }) => isRepresentativeRun);
}

/** One line per URL: the performance score out of 100, LCP in seconds and the CLS score. */
export function summaryLine(url: string, report: unknown): string {
  const { categories, audits } = ReportSchema.parse(report);
  const performance = Math.round(categories.performance.score * 100);
  const lcpSeconds = (audits['largest-contentful-paint'].numericValue / MS_PER_SECOND).toFixed(2);
  const cls = audits['cumulative-layout-shift'].numericValue.toFixed(3);
  return `${url}  performance ${performance}  LCP ${lcpSeconds} s  CLS ${cls}`;
}
