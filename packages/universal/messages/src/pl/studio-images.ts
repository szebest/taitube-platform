import { dt } from '../define';

export const studioImages = {
  imagesTitle: dt('Zdjęcie i baner'),
  imagesDescription: dt(
    'JPEG, PNG lub WebP. Zdjęcie ma do 2 MB i co najmniej 200 x 200 px; baner ma do 6 MB i co najmniej 1024 x 576 px. Każdy obraz kadrujesz przed zapisem.'
  ),
  avatarDrop: dt('Upuść tutaj zdjęcie albo kliknij, aby je wybrać'),
  bannerDrop: dt('Upuść tutaj baner albo kliknij, aby go wybrać'),
  avatarRemove: dt('Usuń zdjęcie'),
  bannerRemove: dt('Usuń baner'),
  avatarPreview: dt('Podgląd zdjęcia'),
  bannerPreview: dt('Podgląd banera'),
  avatarSafeZone: dt('Wyświetlane jako koło: twarze i tekst trzymaj wewnątrz prowadnicy.'),
  bannerSafeZone: dt('Telefony pokazują tylko środkowy pas: tekst trzymaj wewnątrz prowadnicy.'),
  imageTooSmall: dt('Ten obraz jest za mały: musi mieć co najmniej {minWidth} x {minHeight} px.'),
  imageUnreadable: dt('Nie udało się odczytać tego pliku jako obrazu.'),
  cropAvatarTitle: dt('Wykadruj zdjęcie'),
  cropBannerTitle: dt('Wykadruj baner'),
  cropAvatarDescription: dt('Przeciągnij ramkę lub użyj strzałek, aby wybrać, co pokazuje koło.'),
  cropBannerDescription: dt(
    'Wykadruj baner dla każdego ekranu. Przerywana prowadnica jest widoczna na każdym ekranie.'
  ),
  cropScreen: dt('Ekran'),
  cropDesktop: dt('Komputer'),
  cropMobile: dt('Telefon'),
  cropTv: dt('Telewizor'),
  cropPicture: dt('Zdjęcie'),
  cropArea: dt('Obszar kadru. Przesuwaj go strzałkami.'),
  cropZoom: dt('Powiększenie'),
  cropUse: dt('Użyj tego obrazu'),
  cropCancel: dt('Anuluj'),
  cropDone: dt('Gotowe'),
  cropWorking: dt('Przesyłanie i przetwarzanie obrazu'),
  cropReady: dt('Obraz zapisany'),
  cropFailed: dt('Nie udało się zapisać obrazu. Wybierz inny plik albo spróbuj ponownie.'),
};
