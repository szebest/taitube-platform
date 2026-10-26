import { createCompoundContext } from '../../lib/create-compound-context';
import type { AvatarShape, AvatarSize, AvatarTone } from './types';

export const [AvatarContext, useAvatar] = createCompoundContext<{
  size: AvatarSize;
  shape: AvatarShape;
  tone: AvatarTone;
}>('Avatar');
