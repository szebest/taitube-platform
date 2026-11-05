import { dt } from '../define';

export const studioPicks = {
  adminTabCuration: dt('Kuracja'),
  pickTitle: dt('Wybór dnia'),
  pickIntro: dt(
    'Zaplanuj film, od którego zaczyna się strona główna. Terminy nie mogą się nakładać.'
  ),
  pickNew: dt('Zaplanuj wybór'),
  pickCalendar: dt('Najbliższe 30 dni'),
  pickCalendarFailed: dt('Nie udało się wczytać harmonogramu.'),
  pickDayOpen: dt('Nic nie zaplanowano'),
  pickEmptyTitle: dt('Nic nie jest zaplanowane'),
  pickEmptyDescription: dt(
    'Strona główna pokazuje najpopularniejszy film na czasie, dopóki ktoś nie wybierze innego. Zaplanuj pierwszy wybór.'
  ),
  pickChip: dt('{title}, {window}. Edytuj ten wybór.'),
  pickUntitled: dt('Film bez tytułu'),
  pickRunning: dt('Trwa teraz'),
  pickCreateTitle: dt('Zaplanuj wybór'),
  pickEditTitle: dt('Edytuj wybór'),
  pickDialogDescription: dt(
    'Strona główna pokazuje film, Twoją notkę i czas, przez jaki wybór obowiązuje.'
  ),
  pickVideo: dt('Film'),
  pickVideoSearch: dt('Szukaj publicznych filmów'),
  pickVideoLoading: dt('Wyszukiwanie filmów'),
  pickVideoFailed: dt('Nie udało się wczytać filmów.'),
  pickVideoNone: dt('Żaden publiczny, gotowy film nie pasuje.'),
  pickVideoChosen: dt('Wybrano: {title}'),
  pickVideoRequired: dt('Wybierz film.'),
  pickVideoRefused: dt('Wybrać można tylko publiczny, gotowy film.'),
  pickStarts: dt('Początek'),
  pickEnds: dt('Koniec'),
  pickWindowRequired: dt('Ustaw, kiedy wybór się zaczyna i kończy.'),
  pickWindowOrder: dt('Wybór musi kończyć się po swoim początku.'),
  pickWindowPast: dt('Wybór musi jeszcze trwać lub dopiero nadejść.'),
  pickWindowOverlap: dt('Ten termin nakłada się na inny wybór: {title}, {window}.'),
  pickWindowRefused: dt('Ten termin jest nieprawidłowy.'),
  pickNote: dt('Notka'),
  pickNoteHint: dt('Jedna linijka redakcyjna. Zostaw puste, aby nic nie pokazywać.'),
  pickNoteCount: dt('{count:number} z {max:number}'),
  pickNoteTooLong: dt('Notka może mieć najwyżej {max:number} znaków.'),
  pickPreview: dt('Podgląd'),
  pickPreviewEmpty: dt('Wybierz film, aby zobaczyć podgląd wyróżnienia.'),
  pickPreviewWindow: dt('Wybrano {window}'),
  pickSaveFailed: dt('Nie udało się zapisać wyboru.'),
  pickWindowRange: dt('od {start} do {end}'),
  pickCancelAction: dt('Anuluj ten wybór'),
  pickCancelTitle: dt('Anulować ten wybór?'),
  pickCancelDescription: dt(
    '{title} przestaje być wyborem na {window}. Strona główna wraca do tego, co jest na czasie.'
  ),
  pickCancelConfirm: dt('Anuluj wybór'),
  pickCancelKeep: dt('Zachowaj wybór'),
  pickCancelFailed: dt('Nie udało się anulować wyboru.'),
} as const;
