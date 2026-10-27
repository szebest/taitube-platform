import {
  StudioWorkspaceContent,
  StudioWorkspaceProgress,
  StudioWorkspaceRoot,
  StudioWorkspaceToolbar,
} from './studio-workspace';
import { StudioWorkspaceInspector } from './studio-workspace-inspector';
import { StudioWorkspaceNav, StudioWorkspaceNavItem } from './studio-workspace-nav';

export const StudioWorkspace = {
  Root: StudioWorkspaceRoot,
  Nav: StudioWorkspaceNav,
  NavItem: StudioWorkspaceNavItem,
  Toolbar: StudioWorkspaceToolbar,
  Progress: StudioWorkspaceProgress,
  Content: StudioWorkspaceContent,
  Inspector: StudioWorkspaceInspector,
};
export { StudioWorkspaceSkeleton } from './studio-workspace';
export { useStudioWorkspace } from './studio-workspace.context';
export { studioWorkspaceStyles } from './studio-workspace.variants';
