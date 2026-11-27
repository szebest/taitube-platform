import { dt } from '../engine';

export const playlistErrors = {
  playlistCollaboratorExists: dt(
    'Ta osoba już współtworzy playlistę albo czeka na nią zaproszenie.'
  ),
  playlistCollaboratorLimit: dt('Ta playlista ma już maksymalną liczbę współtwórców.'),
  playlistCollaboratorNotFound: dt('Ta osoba nie współtworzy tej playlisty.'),
  playlistInviteInvalid: dt(
    'To zaproszenie wygasło, zostało unieważnione albo wykorzystane. Poproś właściciela o nowe.'
  ),
  playlistActivityNotFound: dt('Tej zmiany nie ma w historii playlisty.'),
  playlistActivityNotRestorable: dt(
    'Tej zmiany nie można cofnąć albo jej film już jest w playliście.'
  ),
};
