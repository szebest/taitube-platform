import { generateFixture } from './generate-fixture';
import { loadManifest } from './probe';
import type { GeneratorOptions } from './types';

export { calculateSha256, loadManifest, probeFile } from './probe';
export { generateFixture } from './generate-fixture';
export { checkFixture } from './check-fixture';

export async function generateAllFixtures(
  options: GeneratorOptions
): Promise<{ generated: string[]; errors: string[] }> {
  const manifest = loadManifest();
  const generated: string[] = [];
  const errors: string[] = [];

  const targets = manifest.fixtures.filter((f) => {
    if (options.only) {
      return f.id === options.only;
    }
    if (f.slow && !options.includeSlow) {
      return false;
    }
    return true;
  });

  for (const fixture of targets) {
    try {
      if (!options.quiet) {
        console.log(`[gen-video] Generating ${fixture.id} (${fixture.filename})...`);
      }
      const out = await generateFixture(fixture, options.outputDir);
      generated.push(out);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to generate ${fixture.id}: ${msg}`);
    }
  }

  return { generated, errors };
}
