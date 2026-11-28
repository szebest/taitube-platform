import { dt, listMore } from '@vp/shared-messages';

export const studioBatch = {
  batchDeleted: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} film usunięty',
        few: '{?} filmy usunięte',
        many: '{?} filmów usuniętych',
        other: '{?} filmu usuniętego',
      },
    },
  }),
  batchUpdated: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} film zaktualizowany',
        few: '{?} filmy zaktualizowane',
        many: '{?} filmów zaktualizowanych',
        other: '{?} filmu zaktualizowanego',
      },
    },
  }),
  batchPartial: dt(
    'Gotowe: {done:number} z {total:number}, niepowodzenia: {failed:number}. Te, którym się nie udało, pozostają zaznaczone.'
  ),
  batchFailed: dt('Nic nie zostało zmienione. Spróbuj ponownie.'),
  batchFailure: dt('{title} ({code}): {reason}'),
  batchFailures: dt('{failures:list}', {
    list: { failures: { type: 'conjunction', max: 5, more: listMore.pl } },
  }),
  batchBarLabel: dt('Akcje dla zaznaczonych filmów'),
  batchAction: dt('{field:enum}', {
    enum: {
      field: {
        visibility: 'Widoczność',
        categoryId: 'Kategoria',
        addTags: 'Dodaj tagi',
        removeTags: 'Usuń tagi',
        commentsEnabled: 'Komentarze',
      },
    },
  }),
  batchFieldTitle: dt('{field:enum}', {
    enum: {
      field: {
        visibility: 'Zmień widoczność',
        categoryId: 'Zmień kategorię',
        addTags: 'Dodaj tagi',
        removeTags: 'Usuń tagi',
        commentsEnabled: 'Włącz lub wyłącz komentarze',
      },
    },
  }),
  batchFieldLabel: dt('{field:enum}', {
    enum: {
      field: {
        visibility: 'Widoczność',
        categoryId: 'Kategoria',
        addTags: 'Tagi do dodania',
        removeTags: 'Tagi do usunięcia',
        commentsEnabled: 'Komentarze',
      },
    },
  }),
  batchFieldAppliesTo: dt('{count:plural}', {
    plural: {
      count: {
        one: 'Dotyczy {?} zaznaczonego filmu.',
        few: 'Dotyczy {?} zaznaczonych filmów.',
        many: 'Dotyczy {?} zaznaczonych filmów.',
        other: 'Dotyczy {?} zaznaczonego filmu.',
      },
    },
  }),
  batchTagsHint: dt('Oddziel tagi przecinkami.'),
  batchApply: dt('Zastosuj'),
  batchCommentsOption: dt('{state:enum}', {
    enum: { state: { on: 'Włączone', off: 'Wyłączone' } },
  }),
} as const;
