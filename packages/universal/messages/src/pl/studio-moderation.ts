import { dt } from '../define';

export const studioModeration = {
  moderationBulkLabel: dt('Moderuj zaznaczone komentarze'),
  moderationAction: dt('{action:enum}', {
    enum: {
      action: {
        approve: 'Zatwierdź',
        hide: 'Ukryj',
        remove: 'Usuń',
        shadow_ban: 'Cichy ban',
        ban: 'Zbanuj',
      },
    },
  }),
  moderationBulkDone: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} komentarz zmieniony',
        few: '{?} komentarze zmienione',
        many: '{?} komentarzy zmienionych',
        other: '{?} komentarza zmienionego',
      },
    },
  }),
  moderationBulkPartial: dt('Gotowe: {done:number} z {total:number}, odrzucone: {failed:number}'),
  moderationBulkRefusal: dt('{id}: {reason}'),
  moderationBulkFailed: dt('Nic nie zostało zmienione. Spróbuj ponownie.'),
  moderationReasonTitle: dt('{action:enum}', {
    enum: {
      action: {
        hide: 'Ukryj z powodem',
        remove: 'Usuń z powodem',
        ban: 'Zbanuj z powodem',
      },
    },
  }),
  moderationReasonDescription: dt('{action:enum}', {
    enum: {
      action: {
        hide: 'Autor widzi, że komentarz jest ukryty, i dlaczego.',
        remove: 'Autor dowiaduje się, że komentarz usunięto, i dlaczego.',
        ban: 'Autor nie może komentować ani reagować i widzi dlaczego.',
      },
    },
  }),
  moderationReasonLabel: dt('Powód'),
  moderationReasonOption: dt('{reason:enum}', {
    enum: {
      reason: {
        spam: 'Spam',
        harassment: 'Nękanie',
        hate: 'Nienawiść',
        misinformation: 'Dezinformacja',
        other: 'Coś innego',
        off_topic: 'Nie na temat',
      },
    },
  }),
  moderationNoteLabel: dt('Wiadomość do autora'),
  moderationDurationLabel: dt('Ban na'),
  moderationDurationOption: dt('{duration:enum}', {
    enum: {
      duration: {
        '1h': '1 godzinę',
        '24h': '24 godziny',
        '7d': '7 dni',
        '30d': '30 dni',
        forever: 'Do odwołania',
      },
    },
  }),
} as const;
