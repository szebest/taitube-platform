import { dt } from '../engine';

export const studioDevelopersTokens = {
  tokensTitle: dt('Personal access tokens'),
  tokensDescription: dt(
    'A token acts as you on the channel it was made on, never with more than your role there allows. Send it from a script, never from a web page.'
  ),
  tokensCaption: dt('Your tokens'),
  tokensCreate: dt('Create token'),
  tokensColumnName: dt('Name'),
  tokensColumnScopes: dt('Scopes'),
  tokensColumnLastUsed: dt('Last used'),
  tokensColumnExpires: dt('Expires'),
  tokensColumnActions: dt('Actions'),
  tokensNeverUsed: dt('Never used'),
  tokensRequestsToday: dt('{count:plural}', {
    plural: { count: { one: '{?} request today', other: '{?} requests today' } },
  }),
  tokensStatus: dt('{status:enum}', {
    enum: { status: { active: 'Active', expired: 'Expired', revoked: 'Revoked' } },
  }),
  tokensRevoke: dt('Revoke {name}'),
  tokensRevokeTitle: dt('Revoke {name}?'),
  tokensRevokeDescription: dt(
    'Scripts using it get a 401 on their next request. This cannot be undone.'
  ),
  tokensRevokeConfirm: dt('Revoke'),
  tokensRevoked: dt('Token revoked'),
  tokensRevokeFailed: dt('The token was not revoked.'),
  tokensEmptyTitle: dt('No tokens yet'),
  tokensEmptyDescription: dt('Create one to call the API from a script.'),
  tokensFailed: dt('Your tokens did not load.'),
  tokensAtLimit: dt(
    'You hold {count:number} active tokens, the most there can be. Revoke one to create another.'
  ),
  tokenDialogTitle: dt('Create a personal access token'),
  tokenDialogDescription: dt(
    'It acts on the channel you are working on now. Pick only the scopes the script needs.'
  ),
  tokenName: dt('Name'),
  tokenNameHint: dt('What the script does, so you know it later. Up to {max:number} characters.'),
  tokenNameRequired: dt('Give the token a name.'),
  tokenExpiry: dt('Expires after'),
  tokenExpiryOption: dt('{expiry:enum}', {
    enum: { expiry: { '30d': '30 days', '90d': '90 days', '1y': '1 year' } },
  }),
  tokenScopes: dt('Scopes'),
  tokenScopesRequired: dt('Pick at least one scope.'),
  tokenScopeGroup: dt('{group:enum}', {
    enum: {
      group: {
        videos: 'Videos',
        analytics: 'Analytics',
        comments: 'Comments',
        exports: 'Exports',
        webhooks: 'Webhooks',
      },
    },
  }),
  tokenScope: dt('{scope:enum}', {
    enum: {
      scope: {
        'videos:read': 'Read videos and their details',
        'videos:write': 'Edit details, chapters and visibility',
        'analytics:read': 'Read views and watch time',
        'comments:read': 'Read comments',
        'comments:moderate': 'Moderate comments',
        'exports:read': 'List and download exports',
        'exports:create': 'Request and delete exports',
        'webhooks:manage': 'Add and remove webhooks',
      },
    },
  }),
  tokenCreateSubmit: dt('Create token'),
  tokenCreateFailed: dt('The token was not created.'),
  tokenCreatedTitle: dt('Copy your token'),
  tokenSecretNotice: dt(
    'This is the only time the token is shown. Put it in your script secrets now; if you lose it, revoke it and create another.'
  ),
  tokenSecretLabel: dt('Token for {name}'),
  tokenSecretSaved: dt('I saved this token somewhere safe'),
};
