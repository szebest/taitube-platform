import { StudioWorkspaceInspector } from './components/studio-workspace-inspector/studio-workspace-inspector';
import {
  StudioWorkspaceNav,
  StudioWorkspaceNavItem,
} from './components/studio-workspace-nav/studio-workspace-nav';
import {
  StudioWorkspaceContent,
  StudioWorkspaceProgress,
  StudioWorkspaceRoot,
  StudioWorkspaceToolbar,
} from './studio-workspace';

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
