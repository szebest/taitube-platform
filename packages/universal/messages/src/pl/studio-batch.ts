import { dt } from '../define';

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
  batchVisibilitySet: dt('{count:plural}', {
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
} as const;
