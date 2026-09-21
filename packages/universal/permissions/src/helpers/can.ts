import type { Action, Resource, UserContext } from '../types/index.js';
import { canAccessAdmin } from './admin.js';
import { canViewAllAnalytics } from './analytics.js';
import { canManageCategory } from './categories.js';
import { canManageChannel, canSubscribeChannel, canUpdateChannel } from './channels.js';
import { canCreateComment, canDeleteComment, canPinComment } from './comments.js';
import {
  canCreateVideo,
  canDeleteVideo,
  canPublishVideo,
  canReactVideo,
  canReadVideo,
  canUpdateVideo,
} from './videos.js';

type ActionCheck = (user: UserContext | null, resource?: Resource) => boolean;

const ACTION_CHECKS: Record<Action, ActionCheck> = {
  'video:read': (user, video) => canReadVideo({ user, video }),
  'video:create': (user) => canCreateVideo({ user }),
  'video:update': (user, video) => canUpdateVideo({ user, video }),
  'video:delete': (user, video) => canDeleteVideo({ user, video }),
  'video:publish': (user, video) => canPublishVideo({ user, video }),
  'video:react': (user) => canReactVideo({ user }),
  'comment:create': (user) => canCreateComment({ user }),
  'comment:delete': (user, comment) => canDeleteComment({ user, comment }),
  'comment:pin': (user, comment) => canPinComment({ user, comment }),
  'channel:update': (user, channel) => canUpdateChannel({ user, channel }),
  'channel:manage': (user, channel) => canManageChannel({ user, channel }),
  'channel:subscribe': (user) => canSubscribeChannel({ user }),
  'category:manage': (user) => canManageCategory({ user }),
  'analytics:view_all': (user) => canViewAllAnalytics({ user }),
  'admin:access': (user) => canAccessAdmin({ user }),
};

export function can(user: UserContext | null, action: Action, resource?: Resource): boolean {
  return ACTION_CHECKS[action]?.(user, resource) ?? false;
}
