import { generateFixture } from './generate-fixture';
import { loadManifest } from './probe';
import type { FixtureDefinition, FixtureManifest, GeneratorOptions } from './types';

export function selectFixtures(
  manifest: FixtureManifest,
  options: GeneratorOptions
): FixtureDefinition[] {
  const { only } = options;
  if (only) {
    const unknown = only.filter((id) => !manifest.fixtures.some((fixture) => fixture.id === id));
    if (unknown.length > 0) throw new Error(`no fixture in the manifest is named ${unknown.join(', ')}`);
    return manifest.fixtures.filter((fixture) => only.includes(fixture.id));
  }
  return manifest.fixtures.filter((fixture) => options.includeSlow || !fixture.slow);
}

export async function generateAllFixtures(
  options: GeneratorOptions,
  onFixture: (id: string) => void
): Promise<{ generated: string[]; errors: string[] }> {
  const manifest = loadManifest();
  const generated: string[] = [];
  const errors: string[] = [];

  const targets = selectFixtures(manifest, options);

  for (const fixture of targets) {
    onFixture(fixture.id);
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
