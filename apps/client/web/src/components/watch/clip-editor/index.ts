import { ClipEditorPreview, ClipEditorRange, ClipEditorRoot } from './clip-editor';

export const ClipEditor = {
  Root: ClipEditorRoot,
  Preview: ClipEditorPreview,
  Range: ClipEditorRange,
};

export { useClipEditor } from './clip-editor.context';
export type { ClipEditorSprite, ClipEditorValue } from './types';
