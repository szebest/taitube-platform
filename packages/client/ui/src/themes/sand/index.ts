import { defineTheme } from '@vp/design-tokens';
import { ambientCinematic } from '../../tokens/ambient/cinematic';
import { borderHairline } from '../../tokens/border/hairline';
import { fontSizeDefault } from '../../tokens/font-size/default';
import { motionStandard } from '../../tokens/motion/standard';
import { radiusRound } from '../../tokens/radius/round';
import { shadowSoft } from '../../tokens/shadow/soft';
import { sizingMedium } from '../../tokens/sizing/medium';
import { spacingDefault } from '../../tokens/spacing/default';
import { typographyFigtree } from '../../tokens/typography/figtree';
import { sandColor } from './color';
import { sandDataviz } from './dataviz';

export const sand = defineTheme({
  id: 'sand',
  name: 'Sand',
  color: sandColor,
  dataviz: sandDataviz,
  defaults: {
    typography: typographyFigtree,
    fontSize: fontSizeDefault,
    spacing: spacingDefault,
    sizing: sizingMedium,
    radius: radiusRound,
    border: borderHairline,
    shadow: shadowSoft,
    ambient: ambientCinematic,
    motion: motionStandard,
  },
});
