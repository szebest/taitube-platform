import { subject } from '@casl/ability';
import { getUserPermissions } from '../ability';
import type { ChannelExportResource, UserContext } from '../types/index';

interface OnExport {
  user: UserContext | null;
  channelExport: ChannelExportResource;
}

export function canCreateChannelExport({ user, channelExport }: OnExport): boolean {
  return getUserPermissions(user).can('create', subject('ChannelExport', { ...channelExport }));
}

export function canReadChannelExport({ user, channelExport }: OnExport): boolean {
  return getUserPermissions(user).can('read', subject('ChannelExport', { ...channelExport }));
}

export function canDeleteChannelExport({ user, channelExport }: OnExport): boolean {
  return getUserPermissions(user).can('delete', subject('ChannelExport', { ...channelExport }));
}
