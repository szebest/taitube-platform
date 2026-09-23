/** Every credential `.env.example`, compose and the k8s base ship for local use. */
const LOCAL_CREDENTIALS = [/^vp$/, /^minioadmin$/, /^admin$/, /^change-me/];

const USERINFO = /^[a-z][a-z0-9+.-]*:\/\/([^/@\s]*)@/i;

function isLocalCredential(value: string): boolean {
  return LOCAL_CREDENTIALS.some((credential) => credential.test(value));
}

export function heldLocalCredentials(value: string): boolean {
  const userinfo = USERINFO.exec(value)?.[1];
  if (userinfo === undefined) return isLocalCredential(value);

  return userinfo.split(':').some((part) => part !== '' && isLocalCredential(part));
}
