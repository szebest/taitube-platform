import { getUserPermissions } from '../ability';
import { toUploadSubject } from '../normalizers/index';
import type { UploadResource, UserContext, VideoResource } from '../types/index';

export function canAccessUpload({
  user,
  upload,
  video,
}: {
  user: UserContext | null;
  upload?: UploadResource;
  video?: VideoResource;
}): boolean {
  if (!user) return false;
  const ability = getUserPermissions(user);
  if (ability.can('manage', 'all')) return true;

  const uploadSubject = toUploadSubject(upload, video);
  if (uploadSubject) {
    return ability.can('access', uploadSubject);
  }
  return ability.can('create', 'Upload');
}
