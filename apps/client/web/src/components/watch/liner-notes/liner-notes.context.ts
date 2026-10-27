import { createCompoundContext } from '@vp/ui';
import type { LinerNotesLayout } from './types';

export const [LinerNotesContext, useLinerNotes] = createCompoundContext<{
  layout: LinerNotesLayout;
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
  seek: (seconds: number) => void;
  bodyId: string;
}>('LinerNotes');
