import { dt } from '../engine';

export const channelErrors = {
  channelMembershipRequired: dt('Nie należysz już do zespołu tego kanału.'),
  channelLimitReached: dt(
    'Masz już tyle kanałów, ile może mieć konto. Usuń jeden, aby dodać kolejny.'
  ),
  channelNotOwned: dt('Tylko właściciel tego kanału może to zrobić.'),
  channelInviteNotFound: dt('To zaproszenie nie istnieje.'),
  channelInviteNotPending: dt(
    'To zaproszenie jest już nieaktualne: zostało przyjęte, odrzucone, cofnięte albo wygasło.'
  ),
  channelInviteAlreadyPending: dt('Ta osoba ma już otwarte zaproszenie do zespołu.'),
  channelMemberExists: dt('Ta osoba jest już w zespole.'),
  channelMemberNotFound: dt('Tej osoby nie ma w zespole.'),
  channelOwnerImmutable: dt('Właściciela kanału nie można usunąć ani zmienić mu roli.'),
};
