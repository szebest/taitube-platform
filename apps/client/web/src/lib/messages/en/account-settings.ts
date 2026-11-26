import { dt } from '@vp/shared-messages';

export const accountSettings = {
  pin: dt('Pin {name}'),
  unpin: dt('Unpin {name}'),
  promoted: dt('{name} is your primary channel now'),
  accentFor: dt('Ring colour for {name}'),
  accentOption: dt('Colour {accent}'),
  signInSlot: dt('Signed in on account {slot:number}'),
  signInDevice: dt('On {device}'),
} as const;
