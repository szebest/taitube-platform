import { loadManifest } from '../../packages/server/gen-video/src/probe';
import { getSpecs } from '../e2e/specs';

const generatedByDefault = new Set(
  loadManifest()
    .fixtures.filter((fixture) => !fixture.slow)
    .map((fixture) => fixture.filename)
);

describe('e2e fixtures', () => {
  it.each(getSpecs().map((spec) => [spec.name, spec.fixtureFile]))(
    'generates the fixture %s reads (%s) with a plain pnpm gen-video',
    (_name, fixtureFile) => {
      expect(generatedByDefault).toContain(fixtureFile);
    }
  );
});
