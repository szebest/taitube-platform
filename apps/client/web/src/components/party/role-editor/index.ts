import {
  RoleEditorList,
  RoleEditorNew,
  RoleEditorPreset,
  RoleEditorRolePart,
  RoleEditorRoot,
} from './role-editor';

export const RoleEditor = {
  Root: RoleEditorRoot,
  List: RoleEditorList,
  Role: RoleEditorRolePart,
  New: RoleEditorNew,
  Preset: RoleEditorPreset,
};
export type {
  RoleEditorPresetProps,
  RoleEditorRoleProps,
  RoleEditorRootProps,
} from './role-editor';
export type { RoleEditorPatch, RoleEditorRole } from './types';
