import { createCompoundContext } from '@vp/ui';
import type { SectionErrorLayout, SectionErrorTone } from './types';

export const [SectionErrorContext, useSectionError] = createCompoundContext<{
  layout: SectionErrorLayout;
  tone: SectionErrorTone;
  retry: () => void;
}>('SectionError');
