import { dt } from '../define';

export const auth = {
  signIn: dt('Zaloguj się'),
  noProvider: dt('W tej wersji nie skonfigurowano żadnego dostawcy logowania.'),
  expired: dt('Twoja sesja wygasła. Zaloguj się ponownie, aby kontynuować.'),
  upload: dt('Prześlij'),
  admin: dt('Admin'),
  signOut: dt('Wyloguj się'),
} as const;
