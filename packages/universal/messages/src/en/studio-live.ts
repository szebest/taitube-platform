import { dt } from '../define';

export const studioLive = {
  liveNav: dt('Live'),
  liveTitle: dt('Live'),
  liveUntitled: dt('Untitled stream'),
  liveStatus: dt('{status:enum}', {
    enum: { status: { IDLE: 'Not live', LIVE: 'Live', ENDED: 'Ended' } },
  }),
  liveLoadFailed: dt('Your live stream did not load.'),
  liveViewersLabel: dt('Viewers now'),
  liveTimeLabel: dt('Time live'),
  liveChatModeLabel: dt('Chat mode'),
  liveChatAudience: dt('{audience:enum}', {
    enum: { audience: { everyone: 'Everyone can chat', subscribers: 'Subscribers only' } },
  }),
  liveSlowModeOff: dt('Slow mode off'),
  liveSlowModeOn: dt('Slow mode: {seconds:plural}', {
    plural: { seconds: { one: '{?} second', other: '{?} seconds' } },
  }),
  liveChartTitle: dt('Viewers while live'),
  liveChartSeries: dt('Viewers'),
  liveChartColumnTime: dt('Time'),
  liveChartColumnViewers: dt('Viewers'),
  liveCredentialsTitle: dt('Connect your encoder'),
  liveCredentialsDescription: dt(
    'Paste the server URL and the stream key into OBS, or broadcast from your browser with WHIP.'
  ),
  liveCredentialsWarning: dt(
    'Anyone with the stream key can broadcast to your channel. Never show it on stream.'
  ),
  liveRtmpUrl: dt('Server URL'),
  liveStreamKey: dt('Stream key'),
  liveWhipUrl: dt('WHIP URL'),
  liveControlToken: dt('Companion control token'),
  liveOverlaysTitle: dt('OBS browser sources'),
  liveOverlaysHint: dt('Add each one in OBS as a browser source.'),
  liveOverlay: dt('{widget:enum} overlay URL', {
    enum: { widget: { chat: 'Chat', alerts: 'Alerts', goal: 'Subscriber goal' } },
  }),
  liveRevealField: dt('Reveal {label}'),
  liveHideField: dt('Hide {label}'),
  liveCopyField: dt('Copy {label}'),
  liveCopied: dt('Copied: {label}'),
  liveCopyFailed: dt('Could not copy: {label}'),
  liveIdleLine: dt('You are not live. Start streaming from OBS and this page goes live with you.'),
  liveEndedLine: dt(
    'This broadcast has ended. The recording is published once it finishes processing.'
  ),
  liveWatchRecording: dt('Watch the recording'),
  liveChatTitle: dt('Chat'),
  liveChatOffline: dt('Chat opens when you go live.'),
  liveChatEmpty: dt('No messages yet.'),
  liveChatViewer: dt('Viewer'),
  liveChatRemove: dt('Remove message from {author}'),
  liveChatRemoved: dt('Message removed'),
  liveChatConnection: dt('{connection:enum}', {
    enum: {
      connection: { connecting: 'Connecting to chat', closed: 'Chat disconnected, reconnecting' },
    },
  }),
  liveChatModeTitle: dt('Chat mode'),
  liveChatModeDescription: dt('Slow mode limits how often a viewer can post.'),
  liveSlowModeLabel: dt('Slow mode'),
  liveSlowModeSeconds: dt('{seconds:plural}', {
    plural: { seconds: { one: '{?} second', other: '{?} seconds' } },
  }),
  liveSubscribersOnly: dt('Subscribers only'),
  liveChatModeSave: dt('Save chat mode'),
  liveChatModeSaved: dt('Chat mode saved'),
  liveChatModeNotSaved: dt('The chat mode was not saved'),
  liveStop: dt('Stop broadcast'),
  liveStopTitle: dt('Stop the broadcast?'),
  liveStopBody: dt(
    'Your encoder is disconnected and the stream ends for every viewer. The recording is published once it finishes processing.'
  ),
  liveStopCancel: dt('Keep streaming'),
  liveStopped: dt('Broadcast stopped'),
  liveNotStopped: dt('The broadcast did not stop'),
  liveOverlayChatLabel: dt('Live chat'),
  liveOverlayNewSubscriber: dt('New subscriber!'),
  liveOverlaySubscribers: dt('{count:plural}', {
    plural: { count: { one: '{?} subscriber', other: '{?} subscribers' } },
  }),
  liveOverlayGoalLabel: dt('Subscriber goal'),
  liveOverlayGoalProgress: dt('{count:number} of {goal:number}'),
} as const;
