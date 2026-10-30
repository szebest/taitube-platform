import { createCompoundContext } from '@vp/ui';
import type { ClipEditorValue } from './types';

export const [ClipEditorContext, useClipEditor] = createCompoundContext<{
  durationMs: number;
  range: ClipEditorValue;
  onRangeChange: (range: ClipEditorValue) => void;
}>('ClipEditor');
