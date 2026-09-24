import { generateFixture } from './generate-fixture';
import { loadManifest } from './probe';
import type { FixtureDefinition, FixtureManifest, GeneratorOptions } from './types';

export function selectFixtures(
  manifest: FixtureManifest,
  options: GeneratorOptions
): FixtureDefinition[] {
  if (options.only) return manifest.fixtures.filter((fixture) => fixture.id === options.only);
  return manifest.fixtures.filter((fixture) => options.includeSlow || !fixture.slow);
}

export async function generateAllFixtures(
  options: GeneratorOptions
): Promise<{ generated: string[]; errors: string[] }> {
  const manifest = loadManifest();
  const generated: string[] = [];
  const errors: string[] = [];

  const targets = selectFixtures(manifest, options);

  for (const fixture of targets) {
    if (!options.quiet) {
      console.log(`[gen-video] Generating ${fixture.id} (${fixture.filename})...`);
    }
    const outcome = generateFixture(fixture, options.outputDir);
    switch (outcome.type) {
      case 'generated':
        generated.push(outcome.path);
        break;
      case 'failed':
        errors.push(`Failed to generate ${fixture.id}: ${outcome.reason}`);
        break;
    }
  }

  return { generated, errors };
}
