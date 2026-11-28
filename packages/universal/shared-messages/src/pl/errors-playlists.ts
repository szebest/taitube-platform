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
  playlistIsSmart: dt(
    'Inteligentna playlista wypełnia się sama według reguł, więc nie można dodawać do niej filmów ręcznie.'
  ),
  playlistNotSmart: dt('Tylko inteligentna playlista ma reguły do zmiany albo zamrożenia.'),
  playlistHasCollaborators: dt(
    'Usuwanie obejrzanych filmów działa tylko na playliście, której nikt inny nie współtworzy.'
  ),
  playlistPinLimit: dt('Masz już przypiętą maksymalną liczbę playlist. Najpierw odepnij jedną.'),
};
