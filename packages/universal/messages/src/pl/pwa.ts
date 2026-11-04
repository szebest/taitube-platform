import { dt } from '../define';

export const pwa = {
  installTitle: dt('Zainstaluj Taitube'),
  installBody: dt('Dodaj Taitube do swojego urządzenia, aby otwierać je jak aplikację.'),
  installAction: dt('Zainstaluj'),
  installDismiss: dt('Nie teraz'),
  updateTitle: dt('Nowa wersja Taitube jest gotowa'),
  updateAction: dt('Odśwież, aby zaktualizować'),
  offlineTitle: dt('Jesteś offline'),
  offlineDescription: dt(
    'Wczytany wcześniej kanał nadal działa. Reszta wróci po przywróceniu połączenia.'
  ),
  offlineBannerDescription: dt('Wczytany wcześniej kanał nadal działa.'),
  offlineToastTitle: dt('Jesteś offline'),
  offlineToastDescription: dt('Wczytany wcześniej kanał pozostaje dostępny.'),
  offlineFeed: dt('Kanał'),
  offlineFeedCount: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} strona',
        few: '{?} strony',
        many: '{?} stron',
        other: '{?} strony',
      },
    },
  }),
  offlineQueuedChanges: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} zmiana zostanie zsynchronizowana po przywróceniu połączenia.',
        few: '{?} zmiany zostaną zsynchronizowane po przywróceniu połączenia.',
        many: '{?} zmian zostanie zsynchronizowanych po przywróceniu połączenia.',
        other: '{?} zmiany zostaną zsynchronizowane po przywróceniu połączenia.',
      },
    },
  }),
  offlineHome: dt('Przejdź do strony głównej'),
  saveOffline: dt('Zapisz do oglądania offline'),
  savedOffline: dt('Zapisano do oglądania offline'),
  saveOfflineDone: dt('Zapisano do oglądania offline'),
  saveOfflineRemoved: dt('Usunięto z zapisanych offline'),
  saveOfflineFailed: dt('Nie udało się zapisać tego filmu do oglądania offline.'),
  saveOfflineQuota: dt('Na tym urządzeniu nie ma dość miejsca, aby zapisać ten film.'),
  saveOfflineUnavailable: dt('Ten film nie ma jeszcze wersji, którą można zapisać.'),
  saveOfflineLimit: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} film jest już zapisany. Usuń go, aby zapisać kolejny.',
        few: '{?} filmy są już zapisane. Usuń jeden, aby zapisać kolejny.',
        many: '{?} filmów jest już zapisanych. Usuń jeden, aby zapisać kolejny.',
        other: '{?} filmu jest już zapisanych. Usuń jeden, aby zapisać kolejny.',
      },
    },
  }),
} as const;
