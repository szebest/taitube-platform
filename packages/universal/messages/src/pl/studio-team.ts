import { dt } from '../define';

const roles = (manager: string, editor: string, moderator: string, analytics: string) =>
  ({ manager, editor, moderator, analytics }) as const;

export const studioTeam = {
  teamNav: dt('Zespół'),
  teamTitle: dt('Zespół'),
  teamTabs: dt('Sekcje zespołu'),
  teamTabMembers: dt('Członkowie'),
  teamTabAudit: dt('Dziennik zmian'),
  teamRole: dt('{role:enum}', {
    enum: { role: roles('Menedżer', 'Edytor', 'Moderator', 'Analityk') },
  }),
  teamRoleSummary: dt('{role:enum}', {
    enum: {
      role: roles(
        'Prowadzi kanał i zespół, z wyjątkiem innych menedżerów.',
        'Dodaje i edytuje filmy oraz stronę kanału.',
        'Pilnuje porządku w komentarzach.',
        'Czyta statystyki i filmy, niczego nie zmienia.'
      ),
    },
  }),
  teamCapability: dt('{capability:enum}', {
    enum: {
      capability: {
        'video.read': 'Widzi prywatne i niepubliczne filmy oraz ich napisy',
        'analytics.read': 'Czyta statystyki i eksporty',
        'video.edit': 'Dodaje i edytuje filmy, miniatury i widoczność',
        'video.delete': 'Usuwa filmy',
        'channel.edit': 'Edytuje stronę i tożsamość kanału',
        'comment.pin': 'Przypina komentarze',
        'content.pin': 'Przypina wpisy i filmy w sekcji Zacznij tutaj',
        'comment.heart': 'Dodaje serduszka do komentarzy',
        'comment.moderate': 'Moderuje komentarze',
        'comment.settings': 'Zmienia ustawienia komentarzy i zablokowane słowa',
        'data.export': 'Eksportuje komentarze, filmy i wpisy',
        'team.manage': 'Zaprasza osoby, zmienia role i czyta dziennik zmian',
        'channel.own': 'Usuwa kanał i przekazuje własność',
      },
    },
  }),
  teamRoleCanTitle: dt('Rola: {role:enum}. Może', {
    enum: { role: roles('Menedżer', 'Edytor', 'Moderator', 'Analityk') },
  }),
  teamMembersCaption: dt('Osoby pracujące nad tym kanałem'),
  teamColumnMember: dt('Członek'),
  teamColumnRole: dt('Rola'),
  teamColumnJoined: dt('Dołączył'),
  teamColumnActions: dt('Akcje'),
  teamRoleOf: dt('Rola: {name}'),
  teamRoleChangeFailed: dt('Nie udało się zmienić roli.'),
  teamRemove: dt('Usuń: {name}'),
  teamRemoveTitle: dt('Usunąć {name} z zespołu?'),
  teamRemoveDescription: dt('Ta osoba od razu traci dostęp do studia tego kanału.'),
  teamRemoveConfirm: dt('Usuń'),
  teamRemoved: dt('Usunięto: {name}'),
  teamRemoveFailed: dt('Nie udało się usunąć członka zespołu.'),
  teamLeave: dt('Opuść zespół'),
  teamLeaveTitle: dt('Opuścić ten zespół?'),
  teamLeaveDescription: dt('Tracisz dostęp do studia tego kanału.'),
  teamLeft: dt('Opuszczono zespół'),
  teamEmptyTitle: dt('Nikogo więcej jeszcze nie ma'),
  teamEmptyDescription: dt('Zaproś kogoś, żeby dać mu rolę w studiu.'),
  teamFailed: dt('Nie udało się wczytać zespołu.'),
  teamNoAccessTitle: dt('Zespół widzą tylko menedżerowie'),
  teamNoAccessDescription: dt('Jeśli potrzebujesz innej roli, zapytaj właściciela kanału.'),
  teamInvite: dt('Zaproś osobę'),
  teamInviteTitle: dt('Zaproś do zespołu'),
  teamInviteDescription: dt(
    'Zaproszona osoba dostaje powiadomienie i sama je przyjmuje. Zaproszenie wygasa po 14 dniach.'
  ),
  teamInviteHandle: dt('Nazwa kanału'),
  teamInviteHandleLabel: dt('Znajdź kanał po nazwie'),
  teamInviteHandlePlaceholder: dt('Wpisz nazwę, bez @'),
  teamInviteNoChannel: dt('Żaden kanał nie ma takiej nazwy'),
  teamInviteChosen: dt('Zapraszasz: {name} (@{handle})'),
  teamInviteRole: dt('Rola'),
  teamInviteSend: dt('Wyślij zaproszenie'),
  teamInviteSent: dt('Wysłano zaproszenie do: {name}'),
  teamInviteFailed: dt('Nie udało się wysłać zaproszenia.'),
  teamInviteAlreadyMember: dt('Ta osoba jest już w zespole.'),
  teamInviteAlreadyPending: dt('Ta osoba ma już oczekujące zaproszenie.'),
  teamInvitesTitle: dt('Oczekujące zaproszenia'),
  teamInvitesCaption: dt('Zaproszenia, na które nikt jeszcze nie odpowiedział'),
  teamInviteExpires: dt('Wygasa'),
  teamInviteRevoke: dt('Cofnij zaproszenie dla: {name}'),
  teamInviteRevoked: dt('Cofnięto zaproszenie'),
  teamInviteRevokeFailed: dt('Nie udało się cofnąć zaproszenia.'),
  teamUnknownMember: dt('Nieznany kanał'),
  teamAuditCaption: dt('Co zmienił zespół, od najnowszych'),
  teamAuditEntries: dt('Wpisy dziennika zmian'),
  teamAuditFilterActor: dt('Kto'),
  teamAuditFilterAction: dt('Co'),
  teamAuditAction: dt('{action:enum}', {
    enum: {
      action: {
        'invite.created': 'Zaprosił(a) osobę',
        'invite.accepted': 'Przyjął(-ęła) zaproszenie',
        'invite.declined': 'Odrzucił(a) zaproszenie',
        'invite.revoked': 'Cofnął(-ęła) zaproszenie',
        'member.role_changed': 'Zmienił(a) rolę',
        'member.removed': 'Usunął(-ęła) członka zespołu',
        'member.left': 'Opuścił(a) zespół',
        'video.updated': 'Edytował(a) film',
      },
    },
  }),
  teamAuditInvited: dt('jako {role:enum}', {
    enum: { role: roles('Menedżer', 'Edytor', 'Moderator', 'Analityk') },
  }),
  teamAuditRoleChanged: dt('była: {from:enum}, jest: {to:enum}', {
    enum: {
      from: roles('Menedżer', 'Edytor', 'Moderator', 'Analityk'),
      to: roles('Menedżer', 'Edytor', 'Moderator', 'Analityk'),
    },
  }),
  teamAuditVideoFields: dt('{fields:list}', {
    list: { fields: { type: 'conjunction' } },
  }),
  teamAuditField: dt('{field:enum}', {
    enum: {
      field: {
        title: 'tytuł',
        description: 'opis',
        visibility: 'widoczność',
        categoryId: 'kategoria',
        tags: 'tagi',
        thumbnail: 'miniatura',
      },
    },
  }),
  teamAuditDeletedActor: dt('Były członek zespołu'),
  teamAuditEmptyTitle: dt('Nic tu jeszcze nie ma'),
  teamAuditEmptyDescription: dt('Zmiany wprowadzone przez zespół pojawią się tutaj.'),
  teamAuditFailed: dt('Nie udało się wczytać dziennika zmian.'),
  channelSwitch: dt('Przełącz kanał'),
  channelSwitchLabel: dt('Kanał, nad którym pracujesz'),
  channelSwitchOwn: dt('{name} (Twój)'),
} as const;
