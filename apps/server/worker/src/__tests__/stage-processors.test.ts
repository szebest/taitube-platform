import * as processors from '../stage-processors';
import { fakeMedia, flowWorld, probed, rungs } from './flow-harness';
import { registryDeps } from './stage-settings';

const BUILDERS = [
  'notify',
  'probe',
  'transcode',
  'captions',
  'live',
  'thumbnail',
  'screen',
  'packaging',
  'housekeeping',
] as const;

describe('apps/server/worker: stage processors', () => {
  const media = fakeMedia(probed({ width: 1280, height: 720, durationMs: 10_000 }, rungs('720p')));

  it.each(BUILDERS)('builds the %s processor from the deps a stage is handed', (name) => {
    const processor = processors[name](registryDeps(flowWorld(), media));

    expect(processor).toBeTypeOf('function');
  });

  it('builds the classifier only for the screen stage, so no other stage verifies the model', () => {
    const deps = registryDeps(flowWorld(), media);
    const built = vi.fn(deps.frameClassifier);

    for (const name of BUILDERS) processors[name]({ ...deps, frameClassifier: built });

    expect(built).toHaveBeenCalledTimes(1);
  });
});
