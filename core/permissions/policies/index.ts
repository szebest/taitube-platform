import type { Action, PolicyRule } from '../types';
import { canManageCategory, canViewAllAnalytics } from './admin-policy';
import { canManageChannel, canUpdateChannel } from './channel-policy';
import { canCreateComment, canDeleteComment, canPinComment } from './comment-policy';
import {
  canCreateVideo,
  canDeleteVideo,
  canPublishVideo,
  canReadVideo,
  canUpdateVideo,
} from './video-policy';

export const POLICIES: Record<Action, PolicyRule> = {
  'video:read': canReadVideo,
  'video:create': canCreateVideo,
  'video:update': canUpdateVideo,
  'video:delete': canDeleteVideo,
  'video:publish': canPublishVideo,
  'comment:create': canCreateComment,
  'comment:delete': canDeleteComment,
  'comment:pin': canPinComment,
  'channel:update': canUpdateChannel,
  'channel:manage': canManageChannel,
  'category:manage': canManageCategory,
  'analytics:view_all': canViewAllAnalytics,
};

export {
  canReadVideo,
  canCreateVideo,
  canUpdateVideo,
  canDeleteVideo,
  canPublishVideo,
  canCreateComment,
  canDeleteComment,
  canPinComment,
  canUpdateChannel,
  canManageChannel,
  canManageCategory,
  canViewAllAnalytics,
};
