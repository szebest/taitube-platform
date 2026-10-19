import type { Scale } from '../schema/scale';
import { declare, rule, stylesheet } from './rule';

export const scaleCss = ({ space, z, layout }: Scale) =>
  stylesheet([
    rule(':root', [
      ...declare(space, (index) => `--space-${index}`),
      ...declare(z, (layer) => `--z-${layer}`),
      ...declare(layout, (measure) => `--layout-${measure}`),
    ]),
  ]);
