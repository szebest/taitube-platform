// The token lives in localStorage, which the server cannot read: every SSR is a guest's.
export type Session = { readonly status: 'guest' };

export function guestSession(): Session {
  return { status: 'guest' };
}
