import { AvatarFallback, AvatarImage, AvatarRoot } from './avatar';

export const Avatar = { Root: AvatarRoot, Image: AvatarImage, Fallback: AvatarFallback };
export type { AvatarFallbackProps, AvatarImageProps, AvatarRootProps } from './avatar';
export { useAvatar } from './avatar.context';
export { avatarStyles } from './avatar.variants';
export type { AvatarShape, AvatarSize, AvatarTone } from './types';
