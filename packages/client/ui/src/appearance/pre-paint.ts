import { PREFERS_LIGHT, PREFERS_REDUCED_MOTION } from './media';
import { REDUCED_MOTION } from './resolve';

/**
 * Runs in the head before the body paints: the server cannot read the viewer's media, so a
 * `system` mode and a reduced-motion request are settled here, and React agrees on hydration.
 */
export const prePaintScript = (followsSystem: boolean) =>
  [
    '{',
    'const root = document.documentElement.dataset;',
    followsSystem ? `root.mode = matchMedia('${PREFERS_LIGHT}').matches ? 'light' : 'dark';` : '',
    `if (matchMedia('${PREFERS_REDUCED_MOTION}').matches) root.motion = '${REDUCED_MOTION}';`,
    '}',
  ]
    .filter((line) => line !== '')
    .join('\n');
