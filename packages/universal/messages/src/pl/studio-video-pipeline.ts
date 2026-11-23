import { dt } from '../define';

const SHAPE = { rect: 'Prostokąt', ellipse: 'Elipsa' } as const;

export const studioVideoPipeline = {
  editTabEditVideo: dt('Edycja filmu'),
  editVideoTitle: dt('Edycja filmu'),
  editVideoDescription: dt(
    'Podmień plik, przytnij go albo rozmyj jego fragmenty. Link, wyświetlenia, polubienia i komentarze zostają, a obecna wersja jest odtwarzana, dopóki nowa nie będzie gotowa.'
  ),
  editVideoLoadFailed: dt('Nie udało się wczytać wersji tego filmu.'),
  editVideoRendering: dt(
    'Trwa przygotowywanie nowej wersji. Obecna jest odtwarzana, dopóki nowa nie będzie gotowa.'
  ),
  editVideoFailed: dt('Ostatniej zmiany nie udało się przetworzyć, więc film pozostał bez zmian.'),
  editVideoNeedsReview: dt('Nowy plik ma inną długość. Sprawdź rozdziały, korekty i napisy.'),
  replaceTitle: dt('Podmień plik'),
  replaceDescription: dt(
    'Prześlij nowy plik tego filmu. Film zachowa link i statystyki, a obecny plik będzie odtwarzany, dopóki nowy nie będzie gotowy.'
  ),
  replaceFileLabel: dt('Nowy plik'),
  replaceStart: dt('Podmień'),
  replaceUploading: dt('Przesyłanie nowego pliku'),
  replaceStarted: dt('Przesyłanie zakończone. Nowy plik jest przetwarzany.'),
  replaceFailed: dt('Nie udało się podmienić pliku.'),
  trimTitle: dt('Przycinanie i rozmycie'),
  trimBaseNotice: dt(
    'Edycje dotyczą oryginalnej wersji, przechowywanej przez 14 dni od ostatniej edycji, aby można było je cofnąć. Potem stają się trwałe, a kolejne edycje dotyczą edytowanego filmu.'
  ),
  trimTimelineLabel: dt('Fragment filmu do zachowania'),
  trimStartLabel: dt('Zachowaj od'),
  trimEndLabel: dt('Zachowaj do'),
  trimSummary: dt('Zachowuje od {start} do {end}'),
  blursTitle: dt('Rozmyte obszary'),
  blursEmpty: dt('Brak rozmytych obszarów.'),
  blursListLabel: dt('Rozmyte obszary tego filmu'),
  blurRow: dt('{shape:enum} od {start} do {end}', { enum: { shape: SHAPE } }),
  blurAdd: dt('Dodaj rozmyty obszar'),
  blurEdit: dt('Edytuj obszar od {start}'),
  blurRemove: dt('Usuń obszar od {start}'),
  blurTimelineLabel: dt('Kiedy obszar jest rozmyty'),
  blurStartLabel: dt('Rozmyj od'),
  blurEndLabel: dt('Rozmyj do'),
  blurSummary: dt('Rozmyty od {start} do {end}'),
  blurShape: dt('Kształt'),
  blurShapeOption: dt('{shape:enum}', { enum: { shape: SHAPE } }),
  blurLeft: dt('Lewa krawędź, % szerokości'),
  blurTop: dt('Górna krawędź, % wysokości'),
  blurWidth: dt('Szerokość, %'),
  blurHeight: dt('Wysokość, %'),
  blurStrength: dt('Siła'),
  editsInvalid: dt(
    'Sprawdź edycje: przycięcie zachowuje co najmniej sekundę, a każdy obszar mieści się w kadrze i w filmie.'
  ),
  editsSave: dt('Zapisz i przetwórz'),
  editsSaved: dt('Edycje zapisane. Trwa przygotowywanie edytowanej wersji.'),
  editsSaveFailed: dt('Nie udało się zapisać edycji.'),
  editsRevert: dt('Przywróć oryginał'),
  editsReverted: dt('Oryginalna wersja wróciła.'),
  editsRevertFailed: dt('Nie udało się cofnąć edycji.'),
  clipSuggestionsTitle: dt('Propozycje klipów'),
  clipSuggestionsDescription: dt(
    'Fragmenty, przy których widzowie zostawali, odczytane z czasu oglądania tej wersji.'
  ),
  clipSuggestionsEmpty: dt('Brak propozycji. Pojawią się, gdy ludzie obejrzą film.'),
  clipSuggestionsLoadFailed: dt('Nie udało się wczytać propozycji klipów.'),
  clipSuggestionsListLabel: dt('Propozycje klipów z tego filmu'),
  clipSuggestionRange: dt('Od {start} do {end}'),
  clipSuggestionLost: dt('W tym czasie odeszło {share} widzów'),
  clipSuggestionCreate: dt('Utwórz klip od {start}'),
  clipSuggestionTitle: dt('Klip od {start}'),
  clipCreated: dt('Klip utworzony'),
  clipCreateFailed: dt('Nie udało się utworzyć klipu.'),
};
