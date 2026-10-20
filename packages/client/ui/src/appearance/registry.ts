import { defineAppearance } from '@vp/design-tokens';
import { nocturne } from '../themes/nocturne';
import { sand } from '../themes/sand';
import { ambientCinematic } from '../tokens/ambient/cinematic';
import { ambientOff } from '../tokens/ambient/off';
import { ambientSubtle } from '../tokens/ambient/subtle';
import { borderBold } from '../tokens/border/bold';
import { borderHairline } from '../tokens/border/hairline';
import { borderRegular } from '../tokens/border/regular';
import { fontSizeDefault } from '../tokens/font-size/default';
import { fontSizeLarge } from '../tokens/font-size/large';
import { fontSizeSmall } from '../tokens/font-size/small';
import { fontSizeXlarge } from '../tokens/font-size/xlarge';
import { motionCalm } from '../tokens/motion/calm';
import { motionReduced } from '../tokens/motion/reduced';
import { motionStandard } from '../tokens/motion/standard';
import { radiusRound } from '../tokens/radius/round';
import { radiusSharp } from '../tokens/radius/sharp';
import { radiusSoft } from '../tokens/radius/soft';
import { shadowDeep } from '../tokens/shadow/deep';
import { shadowFlat } from '../tokens/shadow/flat';
import { shadowSoft } from '../tokens/shadow/soft';
import { sizingLarge } from '../tokens/sizing/large';
import { sizingMedium } from '../tokens/sizing/medium';
import { sizingSmall } from '../tokens/sizing/small';
import { spacingAiry } from '../tokens/spacing/airy';
import { spacingCompact } from '../tokens/spacing/compact';
import { spacingDefault } from '../tokens/spacing/default';
import { typographyFigtree } from '../tokens/typography/figtree';
import { typographyGeist } from '../tokens/typography/geist';
import { typographySystem } from '../tokens/typography/system';

export const appearance = defineAppearance({
  themes: [sand, nocturne],
  defaultTheme: sand,
  offer: {
    typography: [typographyFigtree, typographyGeist, typographySystem],
    fontSize: [fontSizeSmall, fontSizeDefault, fontSizeLarge, fontSizeXlarge],
    spacing: [spacingCompact, spacingDefault, spacingAiry],
    sizing: [sizingSmall, sizingMedium, sizingLarge],
    radius: [radiusSharp, radiusSoft, radiusRound],
    border: [borderHairline, borderRegular, borderBold],
    shadow: [shadowFlat, shadowSoft, shadowDeep],
    ambient: [ambientOff, ambientSubtle, ambientCinematic],
    motion: [motionStandard, motionCalm, motionReduced],
  },
});
