# Projekt zaliczeniowy z przedmiotu Tworzenie Aplikacji Internetowych

Celem projektu było przygotowanie aplikacji internetowej, która jest podobna do istniejącego serwisu Youtube.
Aplikacja udostępniona jest pod adresem: [Taitube](https://youtube-tai.netlify.app/).
Backend aplikacji jest niestety udostępniony w serwisie, który go wyłącza, gdy nie jest robione żadne zapytanie do serwera przez określony czas. Z tego powodu po wejściu na powyższy link należy chwilę poczekać i odświeżyć stronę, tak aby backend znowu się uruchomił. Baza danych jest przechowywana w RAM serwera i ze względu na częste wyłączanie się serwera nie ma żadnej zawartości strony po ponownym uruchomieniu backendu. Logowania do serwisu Facebook jest dostępne tylko dla konkretnych kont, ponieważ aplikacja jest dalej w fazie developmentu.

# Wykorzystane technologie

- React
- SCSS
- Boostrap
- TypeScript
- reduxjs/toolkit

# Funkcje aplikacji

- Logowanie z użyciem serwisu Facebook
- Przegląd zawartości strony
- Możliwość przełączenia pomiędzy trybem jasnym oraz ciemnym
- Możliwość wgrania nowych filmików
- Możliwość edycji/usunięcia swoich filmików
- Możliwość dodania polubienia do filmu
- Możliwość dodania komentarza do filmu
- Możliwość subskrypcji kanału
