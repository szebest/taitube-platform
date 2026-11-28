import { dt } from '@vp/shared-messages';

export const channelPage = {
  tabsLabel: dt('Sekcje kanału'),
  seeAll: dt('Zobacz wszystkie'),
  empty: dt('Nie ma tu jeszcze nic'),
  untitled: dt('Wyróżnione'),
  previewing: dt('Podgląd wersji roboczej jako {audience:enum}', {
    enum: { audience: { visitor: 'nowy widz', subscriber: 'subskrybent' } },
  }),
  playlistVideos: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} film',
        few: '{?} filmy',
        many: '{?} filmów',
        other: '{?} filmu',
        formatter: { notation: 'compact' },
      },
    },
  }),
  liveStatus: dt('{status:enum}', {
    enum: { status: { IDLE: 'Wkrótce', LIVE: 'Na żywo', ENDED: 'Zakończona transmisja' } },
  }),
  liveViewers: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} oglądający',
        few: '{?} oglądających',
        many: '{?} oglądających',
        other: '{?} oglądających',
        formatter: { notation: 'compact' },
      },
    },
  }),
  postTile: dt('Post'),
  playlistTile: dt('Playlista'),
  linksLabel: dt('Linki'),
} as const;
