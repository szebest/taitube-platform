import { defineTheme } from '@vp/design-tokens';
import { ambientSubtle } from '../../tokens/ambient/subtle';
import { borderRegular } from '../../tokens/border/regular';
import { fontSizeDefault } from '../../tokens/font-size/default';
import { motionStandard } from '../../tokens/motion/standard';
import { radiusSharp } from '../../tokens/radius/sharp';
import { shadowFlat } from '../../tokens/shadow/flat';
import { sizingMedium } from '../../tokens/sizing/medium';
import { spacingDefault } from '../../tokens/spacing/default';
import { typographyGeist } from '../../tokens/typography/geist';
import { nocturneColor } from './color';
import { nocturneDataviz } from './dataviz';

export const nocturne = defineTheme({
  id: 'nocturne',
  name: 'Nocturne',
  color: nocturneColor,
  dataviz: nocturneDataviz,
  defaults: {
    typography: typographyGeist,
    fontSize: fontSizeDefault,
    spacing: spacingDefault,
    sizing: sizingMedium,
    radius: radiusSharp,
    border: borderRegular,
    shadow: shadowFlat,
    ambient: ambientSubtle,
    motion: motionStandard,
  },
});
