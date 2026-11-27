import { dt } from '@vp/shared-messages';

export const accountSettings = {
  pin: dt('Przypnij {name}'),
  unpin: dt('Odepnij {name}'),
  promoted: dt('{name} jest teraz twoim głównym kanałem'),
  accentFor: dt('Kolor obwódki dla {name}'),
  accentOption: dt('Kolor {accent}'),
  signInSlot: dt('Zalogowano na koncie {slot:number}'),
  signInDevice: dt('Na {device}'),
} as const;
