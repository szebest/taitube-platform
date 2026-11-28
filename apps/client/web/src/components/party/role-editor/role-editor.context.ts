import { createCompoundContext } from '@kit/ui';
import type { RoleEditorPatch } from './types';

export const [RoleEditorContext, useRoleEditor] = createCompoundContext<{
  voice: boolean;
  onUpdate: (roleId: string, patch: RoleEditorPatch) => void;
  onDelete: (roleId: string) => void;
}>('RoleEditor');
