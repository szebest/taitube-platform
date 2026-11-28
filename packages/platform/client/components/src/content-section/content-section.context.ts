import { createCompoundContext } from '@kit/ui';
import type {
  ContentSectionDensity,
  ContentSectionLayout,
  ContentSectionShelfVariant,
} from './types';

export const [ContentSectionContext, useContentSection] = createCompoundContext<{
  layout: ContentSectionLayout;
  density: ContentSectionDensity;
  shelfVariant: ContentSectionShelfVariant;
  titleId: string;
}>('ContentSection');
