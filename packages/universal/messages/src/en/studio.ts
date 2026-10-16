import { dt } from '../define';

export const studio = {
  title: dt('Creator Studio'),
  backToWeb: dt('Back to Taitube'),
  devTokenRequired: dt(
    'This origin has no dev token yet: run pnpm dev-token and store it as AUTH_TOKEN in localStorage'
  ),
} as const;
