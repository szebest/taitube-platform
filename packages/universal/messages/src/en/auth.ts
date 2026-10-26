import { dt } from '../define';

export const auth = {
  signIn: dt('Sign in'),
  noProvider: dt('No sign-in provider is configured for this build.'),
  expired: dt('Your session ended. Sign in again to carry on.'),
  upload: dt('Upload'),
  admin: dt('Admin'),
  signOut: dt('Sign out'),
} as const;
