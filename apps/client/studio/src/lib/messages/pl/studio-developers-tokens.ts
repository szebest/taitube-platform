import { dt } from '@vp/shared-messages';

export const studioDevelopersTokens = {
  tokensTitle: dt('Osobiste tokeny dostępu'),
  tokensDescription: dt(
    'Token działa jako Ty na kanale, na którym powstał, i nigdy nie może więcej niż Twoja rola. Używaj go w skrypcie, nigdy na stronie internetowej.'
  ),
  tokensCaption: dt('Twoje tokeny'),
  tokensCreate: dt('Utwórz token'),
  tokensColumnName: dt('Nazwa'),
  tokensColumnScopes: dt('Zakresy'),
  tokensColumnLastUsed: dt('Ostatnie użycie'),
  tokensColumnExpires: dt('Wygasa'),
  tokensColumnActions: dt('Akcje'),
  tokensNeverUsed: dt('Nieużywany'),
  tokensRequestsToday: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} żądanie dziś',
        few: '{?} żądania dziś',
        many: '{?} żądań dziś',
        other: '{?} żądania dziś',
      },
    },
  }),
  tokensStatus: dt('{status:enum}', {
    enum: { status: { active: 'Aktywny', expired: 'Wygasł', revoked: 'Unieważniony' } },
  }),
  tokensRevoke: dt('Unieważnij: {name}'),
  tokensRevokeTitle: dt('Unieważnić token {name}?'),
  tokensRevokeDescription: dt(
    'Skrypty, które go używają, dostaną 401 przy następnym żądaniu. Tego nie można cofnąć.'
  ),
  tokensRevokeConfirm: dt('Unieważnij'),
  tokensRevoked: dt('Token unieważniony'),
  tokensRevokeFailed: dt('Nie udało się unieważnić tokenu.'),
  tokensEmptyTitle: dt('Nie masz jeszcze tokenów'),
  tokensEmptyDescription: dt('Utwórz token, aby wywoływać API ze skryptu.'),
  tokensFailed: dt('Nie udało się wczytać tokenów.'),
  tokensAtLimit: dt(
    'Masz {count:number} aktywnych tokenów, czyli najwięcej, ile można. Unieważnij jeden, aby utworzyć kolejny.'
  ),
  tokenDialogTitle: dt('Utwórz osobisty token dostępu'),
  tokenDialogDescription: dt(
    'Działa na kanale, nad którym teraz pracujesz. Wybierz tylko te zakresy, których skrypt potrzebuje.'
  ),
  tokenName: dt('Nazwa'),
  tokenNameHint: dt('Co robi skrypt, abyś go później rozpoznał. Do {max:number} znaków.'),
  tokenNameRequired: dt('Nadaj tokenowi nazwę.'),
  tokenExpiry: dt('Wygasa po'),
  tokenExpiryOption: dt('{expiry:enum}', {
    enum: { expiry: { '30d': '30 dniach', '90d': '90 dniach', '1y': '1 roku' } },
  }),
  tokenScopes: dt('Zakresy'),
  tokenScopesRequired: dt('Wybierz co najmniej jeden zakres.'),
  tokenScopeGroup: dt('{group:enum}', {
    enum: {
      group: {
        videos: 'Filmy',
        analytics: 'Statystyki',
        comments: 'Komentarze',
        exports: 'Eksporty',
        webhooks: 'Webhooki',
        posts: 'Wpisy',
      },
    },
  }),
  tokenScope: dt('{scope:enum}', {
    enum: {
      scope: {
        'videos:read': 'Odczyt filmów i ich szczegółów',
        'videos:write': 'Edycja szczegółów, rozdziałów i widoczności',
        'analytics:read': 'Odczyt wyświetleń i czasu oglądania',
        'comments:read': 'Odczyt komentarzy',
        'comments:moderate': 'Moderowanie komentarzy',
        'exports:read': 'Lista i pobieranie eksportów',
        'exports:create': 'Zamawianie i usuwanie eksportów',
        'webhooks:manage': 'Dodawanie i usuwanie webhooków',
        'posts:write': 'Publikowanie, edycja i usuwanie wpisów',
      },
    },
  }),
  tokenCreateSubmit: dt('Utwórz token'),
  tokenCreateFailed: dt('Nie udało się utworzyć tokenu.'),
  tokenCreatedTitle: dt('Skopiuj token'),
  tokenSecretNotice: dt(
    'Token jest pokazywany tylko teraz. Zapisz go w sekretach skryptu; jeśli go zgubisz, unieważnij go i utwórz nowy.'
  ),
  tokenSecretLabel: dt('Token: {name}'),
  tokenSecretSaved: dt('Zapisałem token w bezpiecznym miejscu'),
};
