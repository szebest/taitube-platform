import type { DataExportKind } from '@vp/domain';

/** `ownerId` is the channel owner's user id, which the owner rule keys on. */
export interface ChannelExportResource {
  readonly channelId: string;
  readonly ownerId: string;
  readonly kind: DataExportKind;
}
