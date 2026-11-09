import {
  AuditLogListAction,
  AuditLogListActor,
  AuditLogListAvatar,
  AuditLogListBody,
  AuditLogListDetail,
  AuditLogListItem,
  AuditLogListRoot,
  AuditLogListTime,
} from './audit-log-list';

export const AuditLogList = {
  Root: AuditLogListRoot,
  Item: AuditLogListItem,
  Avatar: AuditLogListAvatar,
  Body: AuditLogListBody,
  Actor: AuditLogListActor,
  Action: AuditLogListAction,
  Detail: AuditLogListDetail,
  Time: AuditLogListTime,
};
export type { AuditLogListAvatarProps } from './audit-log-list';
