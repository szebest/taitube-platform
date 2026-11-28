import { dt } from '../engine';

export const linkErrors = {
  contentLinkNotFound: dt('This link does not exist or was removed.'),
  linkPairNotAllowed: dt('This kind of link cannot join these two items.'),
  linkRelationSameChannel: dt('This kind of link only works inside one channel.'),
  linkTargetBlocks: dt('This channel does not accept links from other channels.'),
  linkTargetNotPublic: dt('Only public, ready content of another channel can be linked.'),
  linkSelf: dt('An item cannot link to itself.'),
  linkLoop: dt('This link would make the series loop back on itself.'),
  linkLimit: dt('This item or channel has as many links as it can hold.'),
  linkAnchorInvalid: dt('Pick a moment or span inside the video.'),
  linkExists: dt('This link already exists.'),
  linkSuggestionLimit: dt('You have suggested as many links as you can today.'),
  endScreenInvalid: dt('This end screen does not fit the video. Check its start time and items.'),
} as const;
