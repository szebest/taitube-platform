import { AccountMenu as SessionAccountMenu } from '@vp/queries';

import { STUDIO_URL } from '#app/config';

/** The viewer's account in web's header: the shared menu, its upload and admin links on the studio. */
export function AccountMenu() {
  return <SessionAccountMenu studioUrl={STUDIO_URL} />;
}
