import { dt } from '../engine';

export const postErrors = {
  postNotFound: dt('Ten post nie istnieje lub został usunięty.'),
  postShareNotPublic: dt('W poście można udostępnić tylko publiczny film lub playlistę.'),
  postDailyLimit: dt('Ten kanał opublikował dziś już wszystkie dostępne posty.'),
  postAlreadyVoted: dt('Oddano już głos w tym poście.'),
  postPollClosed: dt('To głosowanie jest już zamknięte.'),
  postPollLocked: dt('Głosowania nie można zmienić po pierwszym głosie.'),
  postPinLimit: dt('Kanał może przypiąć do 3 postów. Najpierw odepnij jeden.'),
  postDraftLimit: dt('Ten kanał ma już maksymalną liczbę wersji roboczych i zaplanowanych postów.'),
  postScheduleInvalid: dt('Wybierz przyszły termin dla zaplanowanego posta.'),
  postImageNotReady: dt('Obraz tego posta nie jest gotowy lub nie pochodzi z tego kanału.'),
  threadNotFound: dt('Ten wątek nie istnieje lub został usunięty.'),
  threadLimit: dt('Masz już 5 otwartych wątków pod tym filmem.'),
  threadPinLimit: dt('Film może mieć przypięte do 3 wątków. Najpierw odepnij jeden.'),
  threadAnchorInvalid: dt('Wybierz moment wewnątrz filmu.'),
} as const;
