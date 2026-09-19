import { getUserPermissions } from '../ability.js';
import { toVideoSubject } from '../normalizers/index.js';
import type { UserContext, VideoResource } from '../types/index.js';

export function canReadVideo({
  user,
  video,
}: {
  user: UserContext | null;
  video?: VideoResource;
}): boolean {
  const ability = getUserPermissions(user);
  const videoSubject = toVideoSubject(video);
  if (!videoSubject) {
    return ability.can('read', 'Video');
  }
  return ability.can('read', videoSubject);
}

export function canCreateVideo({ user }: { user: UserContext | null }): boolean {
  if (!user) return false;
  const ability = getUserPermissions(user);
  return ability.can('create', 'Video');
}

export function canUpdateVideo({
  user,
  video,
  fields,
}: {
  user: UserContext | null;
  video?: VideoResource;
  fields?: string[];
}): boolean {
  if (!user) return false;
  const ability = getUserPermissions(user);
  if (!(video?.ownerId || video?.userId)) {
    return ability.can('manage', 'all');
  }
  const videoSubject = toVideoSubject(video);
  if (!videoSubject) return false;
  if (fields && fields.length > 0) {
    return fields.every((f) => ability.can('update', videoSubject, f));
  }
  return ability.can('update', videoSubject);
}

export function canDeleteVideo({
  user,
  video,
}: {
  user: UserContext | null;
  video?: VideoResource;
}): boolean {
  if (!user) return false;
  const ability = getUserPermissions(user);
  if (!(video?.ownerId || video?.userId)) {
    return ability.can('manage', 'all');
  }
  const videoSubject = toVideoSubject(video);
  if (!videoSubject) return false;
  return ability.can('delete', videoSubject);
}

export function canPublishVideo({
  user,
  video,
}: {
  user: UserContext | null;
  video?: VideoResource;
}): boolean {
  if (!user) return false;
  const ability = getUserPermissions(user);
  const videoSubject = toVideoSubject(video);
  if (!videoSubject) {
    return ability.can('publish', 'Video');
  }
  return ability.can('publish', videoSubject);
}

export function canReactVideo({ user }: { user: UserContext | null }): boolean {
  if (!user) return false;
  const ability = getUserPermissions(user);
  return ability.can('react', 'Video');
}
