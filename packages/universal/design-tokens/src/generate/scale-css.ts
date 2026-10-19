import type { Scale } from '../schema/scale';
import { declare, rule, stylesheet } from './rule';

export const scaleDeclarations = ({ space, z, layout }: Scale) => [
  ...declare(space, (index) => ({ property: `--space-${index}` })),
  ...declare(z, (layer) => ({ property: `--z-${layer}`, utility: `--z-index-${layer}` })),
  ...declare(layout, (measure) => ({
    property: `--layout-${measure}`,
    utility: `--container-${measure}`,
  })),
];

export const scaleCss = (scale: Scale) => stylesheet([rule(':root', scaleDeclarations(scale))]);
