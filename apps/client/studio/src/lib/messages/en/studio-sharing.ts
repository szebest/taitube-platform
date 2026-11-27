import { dt } from '@vp/shared-messages';

export const studioSharing = {
  shareLinksTitle: dt('Share links'),
  shareLinksDescription: dt(
    'A share link lets whoever holds it watch this video, whatever its visibility, and nothing else. Up to 50 links are active at once.'
  ),
  shareLinkLabel: dt('Label'),
  shareLinkLabelHint: dt('Optional, up to {max} characters. Only you see it.'),
  shareLinkLabelTooLong: dt('Use a label of up to {max} characters.'),
  shareLinkExpiry: dt('Expires after'),
  shareLinkExpiryOption: dt('{expiry:enum}', {
    enum: {
      expiry: {
        '1h': '1 hour',
        '24h': '24 hours',
        '7d': '7 days',
        '30d': '30 days',
        never: 'Never',
      },
    },
  }),
  shareLinkCreate: dt('Create link'),
  shareLinkCreated: dt('Share link created'),
  shareLinkCreateFailed: dt('The share link was not created.'),
  shareLinksEmpty: dt('No share links yet.'),
  shareLinksLoadFailed: dt('The share links did not load.'),
  shareLinksTableLabel: dt('Share links of this video'),
  shareLinksColumnLabel: dt('Label'),
  shareLinksColumnState: dt('State'),
  shareLinksColumnExpires: dt('Expires'),
  shareLinksColumnOpens: dt('Opens'),
  shareLinksColumnViews: dt('Views'),
  shareLinksColumnWatchTime: dt('Watch time'),
  shareLinksColumnActions: dt('Actions'),
  shareLinkNoLabel: dt('No label'),
  shareLinkNeverExpires: dt('Never'),
  shareLinkState: dt('{state:enum}', {
    enum: { state: { active: 'Active', expired: 'Expired', revoked: 'Revoked' } },
  }),
  shareLinkCopy: dt('Copy link'),
  shareLinkCopyFor: dt('Copy the link {label}'),
  shareLinkCopied: dt('share link'),
  shareLinkRevoke: dt('Revoke'),
  shareLinkRevokeFor: dt('Revoke the link {label}'),
  shareLinkRevoked: dt('Share link revoked'),
  shareLinkRevokeFailed: dt('The share link was not revoked.'),
  passwordTitle: dt('Password'),
  passwordDescription: dt(
    'Viewers type the password once on the watch page or the embed, and watch for 12 hours.'
  ),
  passwordSwitch: dt('Protect with a password'),
  passwordField: dt('Password'),
  passwordHint: dt('{min} to {max} characters. It is never shown again, not even to you.'),
  passwordInvalid: dt('Use {min} to {max} characters.'),
  passwordUnlistedOnly: dt(
    'Only an unlisted video takes a password. Set the visibility to unlisted on the Details tab first.'
  ),
  passwordOn: dt('Viewers need the password to watch this video.'),
  passwordSave: dt('Save password'),
  passwordSaved: dt('Password saved'),
  passwordSaveFailed: dt('The password was not saved.'),
  passwordRemove: dt('Remove password'),
  passwordRemoved: dt('Password removed'),
  passwordRemoveFailed: dt('The password was not removed.'),
  accessGateTitle: dt('An access gate, not encryption'),
  accessGateBody: dt(
    'Share links and passwords decide whom the page, the player and the API let through. The video itself stays in the public storage under addresses nobody can guess, exactly as an unlisted video does.'
  ),
} as const;
