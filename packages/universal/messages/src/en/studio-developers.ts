import { dt } from '../engine';
import { studioDevelopersTokens } from './studio-developers-tokens';

export const studioDevelopers = {
  ...studioDevelopersTokens,
  developersNav: dt('Developers'),
  developersTitle: dt('Developers'),
  developersDescription: dt(
    'Tokens for your own scripts, webhooks that tell them what happened, and your channel data to take away.'
  ),
  secretDone: dt('Done'),
  webhooksTitle: dt('Webhooks'),
  webhooksDescription: dt(
    'We POST a signed JSON body to your address when something happens. Check X-Taitube-Signature-256 against the secret.'
  ),
  webhooksCaption: dt('Your webhooks'),
  webhooksCreate: dt('Add webhook'),
  webhooksColumnUrl: dt('Address'),
  webhooksColumnEvents: dt('Events'),
  webhooksColumnCreated: dt('Added'),
  webhooksColumnActions: dt('Actions'),
  webhookEvent: dt('{event:enum}', {
    enum: {
      event: {
        'video.ready': 'Video ready',
        'live.started': 'Live started',
        'export.ready': 'Export ready',
        'comment.held': 'Comment held',
      },
    },
  }),
  webhookEventHint: dt('{event:enum}', {
    enum: {
      event: {
        'video.ready': 'A video finished processing and is published.',
        'live.started': 'Reserved: nothing sends it yet.',
        'export.ready': 'A channel export can be downloaded.',
        'comment.held': 'A comment waits for review. Ids only, never the text.',
      },
    },
  }),
  webhooksSendTest: dt('Send test'),
  webhooksSendTestLabel: dt('Send test to {url}'),
  webhooksTestDelivered: dt('Test delivered to {url}'),
  webhooksTestRefused: dt('Test not delivered to {url}'),
  webhooksTestReason: dt('{reason:enum}', {
    enum: {
      reason: {
        timeout: 'It did not answer within five seconds.',
        network: 'It could not be reached.',
        status: 'It answered with an error.',
        'blocked-host': 'Its host is not allowed.',
        redirect: 'It answered with a redirect, which is never followed.',
      },
    },
  }),
  webhooksTestStatus: dt('It answered {status:number}.'),
  webhooksTestFailed: dt('The test was not sent.'),
  webhooksDelete: dt('Remove {url}'),
  webhooksDeleteTitle: dt('Remove this webhook?'),
  webhooksDeleteDescription: dt('Deliveries to {url} stop at once.'),
  webhooksDeleteConfirm: dt('Remove'),
  webhooksDeleted: dt('Webhook removed'),
  webhooksDeleteFailed: dt('The webhook was not removed.'),
  webhooksEmptyTitle: dt('No webhooks yet'),
  webhooksEmptyDescription: dt(
    'Add one to hear about new videos, finished exports and held comments.'
  ),
  webhooksFailed: dt('Your webhooks did not load.'),
  webhookDialogTitle: dt('Add a webhook'),
  webhookDialogDescription: dt('Pick the events your receiver handles.'),
  webhookUrl: dt('Payload address'),
  webhookUrlHint: dt('https only, on a public host, without a user name or password.'),
  webhookUrlRequired: dt('Enter the address to deliver to.'),
  webhookEvents: dt('Events'),
  webhookEventsRequired: dt('Pick at least one event.'),
  webhookCreateSubmit: dt('Add webhook'),
  webhookCreateFailed: dt('The webhook was not added.'),
  webhookCreatedTitle: dt('Copy the signing secret'),
  webhookSecretNotice: dt(
    'This is the only time the secret is shown. Your receiver needs it to check the signature of every delivery.'
  ),
  webhookSecretLabel: dt('Signing secret'),
  webhookSecretSaved: dt('I saved this secret somewhere safe'),
  exportsTitle: dt('Exports'),
  exportsDescription: dt(
    'Your analytics, comments and video details as CSV or JSON. A file is kept for {days:number} days.'
  ),
  exportsCaption: dt('Your channel exports'),
  exportsRequest: dt('Request export'),
  exportsColumnKind: dt('Data'),
  exportsColumnRange: dt('Range'),
  exportsColumnStatus: dt('Status'),
  exportsColumnRequested: dt('Requested'),
  exportsColumnActions: dt('Actions'),
  exportKind: dt('{kind:enum}', {
    enum: {
      kind: {
        video_analytics: 'Video analytics',
        channel_analytics: 'Channel analytics',
        comments: 'Comments',
        videos: 'Videos',
      },
    },
  }),
  exportFormat: dt('{format:enum}', { enum: { format: { csv: 'CSV', json: 'JSON' } } }),
  exportRangeAll: dt('Everything'),
  exportRangeFrom: dt('From {from}'),
  exportRangeTo: dt('Up to {to}'),
  exportRangeBetween: dt('{from} to {to}'),
  exportStatus: dt('{status:enum}', {
    enum: {
      status: {
        queued: 'Queued',
        running: 'Writing',
        ready: 'Ready',
        failed: 'Failed',
        expired: 'Expired',
      },
    },
  }),
  exportRows: dt('{count:plural}', { plural: { count: { one: '{?} row', other: '{?} rows' } } }),
  exportsDownload: dt('Download'),
  exportsDownloadLabel: dt('Download the {kind} export'),
  exportsDownloadFailed: dt('The file could not be fetched.'),
  exportsDelete: dt('Delete the {kind} export'),
  exportsDeleted: dt('Export deleted'),
  exportsDeleteFailed: dt('The export was not deleted.'),
  exportsReady: dt('Your {kind} export is ready'),
  exportsFailedEvent: dt('Your {kind} export failed'),
  exportsEmptyTitle: dt('No exports yet'),
  exportsEmptyDescription: dt('Request one to take your data into a spreadsheet.'),
  exportsFailed: dt('Your exports did not load.'),
  exportDialogTitle: dt('Request an export'),
  exportDialogDescription: dt(
    'One export runs at a time, {perDay:number} a day. This page says when the file is ready.'
  ),
  exportKindLabel: dt('Data'),
  exportFormatLabel: dt('Format'),
  exportRangeLabel: dt('Range'),
  exportRangeOption: dt('{range:enum}', {
    enum: {
      range: {
        '7d': 'Last 7 days',
        '30d': 'Last 30 days',
        '90d': 'Last 90 days',
        lifetime: 'Everything',
      },
    },
  }),
  exportRequestSubmit: dt('Request export'),
  exportRequested: dt('Export requested'),
  exportRequestFailed: dt('The export was not requested.'),
  referenceTitle: dt('API reference'),
  referenceDescription: dt(
    'Every route, the scope it needs and its errors are in the OpenAPI document. Each example below reads the token from TAITUBE_TOKEN.'
  ),
  referenceDocument: dt('OpenAPI document'),
  referenceBrowse: dt('Browse the reference'),
  referenceExamples: dt('Examples by scope'),
  referenceCopyExample: dt('Copy curl for {scope}'),
  referenceExampleLabel: dt('curl for {scope}'),
};
