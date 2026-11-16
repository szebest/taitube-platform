import { join } from 'node:path';
import { isErr } from '@vp/result';
import { ensureClip } from '../media';
import type { Scenario } from '../scenario';
import { createTally } from '../tally';

export const media: Scenario = {
  name: 'media',
  essential: false,
  needsReady: false,
  requires: [],
  async run({ world, options, ports, state, log }) {
    const tally = createTally();
    const mediaDir = join(options.workDir, 'media');
    for (const video of world.videos) {
      const clip = await ensureClip(ports, mediaDir, video);
      if (isErr(clip)) {
        tally.fail(clip.error);
        continue;
      }
      state.clips.set(video.key, clip.value.path);
      if (clip.value.reused) tally.existing();
      else {
        tally.created();
        log(`  rendered ${video.key} (${video.seconds}s ${video.shape})`);
      }
    }
    return tally.outcome('clips');
  },
};
