import type { WatchPartyPermission } from '@vp/domain';

export interface RoleEditorRole {
  id: string;
  key: string | null;
  name: string;
  colour: string | null;
  position: number;
  permissions: readonly WatchPartyPermission[];
  memberCount: number;
  updatedAt: string;
}

export interface RoleEditorPatch {
  name?: string;
  colour?: string;
  permissions?: WatchPartyPermission[];
}
