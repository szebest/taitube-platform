import { dt } from '../define';

export const shorts = {
  title: dt('Shorts'),
  emptyTitle: dt('Tutaj pojawią się filmy Shorts'),
  emptyDescription: dt(
    'Krótkie filmy pionowe są w drodze. Do tego czasu na stronie głównej jest mnóstwo do obejrzenia.'
  ),
  browse: dt('Przeglądaj filmy'),
  controls: dt('Sterowanie filmem Short'),
  announce: dt('{title}, autor: {channel}'),
} as const;
