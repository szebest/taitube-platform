import { dt } from '../define';

export const studioChannel = {
  handleCooldownNotice: dt(
    'A handle changes once every 30 days. The old one keeps opening your channel for 90 days, and nobody else can take it meanwhile.'
  ),
  handleCooldownUntil: dt('Your handle can change again on {date}.'),
  countryLabel: dt('Country'),
  countryNone: dt('Not shown'),
  contactEmailLabel: dt('Contact email'),
  contactEmailHint: dt(
    'Shown only to signed-in viewers who ask for it. Nothing is ever sent to it.'
  ),
  contactEmailInvalid: dt('Enter a valid email address.'),
  linksTitle: dt('Links'),
  linksDescription: dt('Up to 8 links on your About tab, and one button on your banner.'),
  linkPlatform: dt('Recognised as {platform}'),
  moveLinkUp: dt('Move link {position} up'),
  moveLinkDown: dt('Move link {position} down'),
  bannerLinkTitle: dt('Banner button'),
  bannerLinkLabel: dt('Button label'),
  bannerLinkUrl: dt('Button address'),
  bannerLinkHint: dt(
    'Up to 24 characters and an https address. It sits inside the banner, never over all of it.'
  ),
  bannerLinkInvalid: dt('Use a label of up to 24 characters and an https address.'),
  spotlightTitle: dt('Trailer and welcome back'),
  spotlightDescription: dt(
    'The video visitors see first on your channel, and the one subscribers see instead. Only your public, ready videos.'
  ),
  spotlightTrailer: dt('Trailer for visitors'),
  spotlightReturning: dt('Video for subscribers'),
  spotlightChoose: dt('Choose a video'),
  spotlightChange: dt('Change video'),
  spotlightClear: dt('Remove'),
  spotlightSet: dt('A video is set'),
  spotlightNone: dt('None set'),
  spotlightLanguages: dt('Languages'),
  spotlightDefault: dt('Default'),
  spotlightLocaleDescription: dt('Description in {language}'),
  spotlightLocaleTrailer: dt('Trailer in {language}'),
  spotlightLocaleHint: dt('Left empty, viewers of this language get the default.'),
  spotlightInvalid: dt('A video must be public and ready, and yours.'),
};
