import { createCompoundContext } from '@vp/ui';
import type { InspectorSide, WorkspaceLayout } from './types';

export const [StudioWorkspaceContext, useStudioWorkspace] = createCompoundContext<{
  layout: WorkspaceLayout;
  navCollapsed: boolean;
  navId: string;
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;
  inspectorOpen: boolean;
  setInspectorOpen: (open: boolean) => void;
  inspectorSide: InspectorSide;
}>('StudioWorkspace');
