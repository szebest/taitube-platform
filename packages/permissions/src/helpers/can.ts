import type { Action, Resource, UserContext } from '../types/index.js';
import { canAccessAdmin } from './admin.js';
import { canViewAllAnalytics } from './analytics.js';
import { canManageCategory } from './categories.js';
import { canManageChannel, canUpdateChannel } from './channels.js';
import { canCreateComment, canDeleteComment, canPinComment } from './comments.js';
import {
  canCreateVideo,
  canDeleteVideo,
  canPublishVideo,
  canReactVideo,
  canReadVideo,
  canUpdateVideo,
} from './videos.js';

export function can(user: UserContext | null, action: Action, resource?: Resource): boolean {
  switch (action) {
    case 'video:read':
      return canReadVideo({ user, video: resource });
    case 'video:create':
      return canCreateVideo({ user });
    case 'video:update':
      return canUpdateVideo({ user, video: resource });
    case 'video:delete':
      return canDeleteVideo({ user, video: resource });
    case 'video:publish':
      return canPublishVideo({ user, video: resource });
    case 'video:react':
      return canReactVideo({ user });
    case 'comment:create':
      return canCreateComment({ user });
    case 'comment:delete':
      return canDeleteComment({ user, comment: resource });
    case 'comment:pin':
      return canPinComment({ user, comment: resource });
    case 'channel:update':
      return canUpdateChannel({ user, channel: resource });
    case 'channel:manage':
      return canManageChannel({ user, channel: resource });
    case 'category:manage':
      return canManageCategory({ user });
    case 'analytics:view_all':
      return canViewAllAnalytics({ user });
    case 'admin:access':
      return canAccessAdmin({ user });
    default:
      return false;
  }
}
