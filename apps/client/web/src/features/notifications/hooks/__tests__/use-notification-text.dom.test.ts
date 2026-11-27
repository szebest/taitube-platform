import { renderHook } from '@testing-library/react';
import type { Notification } from '@vp/api-contracts';
import { AppProviders } from '#app/__tests__/providers';
import {
  NOTIFICATION_ID,
  notification,
} from '#app/features/notifications/__tests__/notification-fixtures';
import { useNotificationText } from '../use-notification-text';

const textOf = (shown: Notification) =>
  renderHook(useNotificationText, { wrapper: AppProviders }).result.current(shown);

describe('apps/client/web: useNotificationText', () => {
  it.each<{ case: string; shown: Notification; headline: string }>([
    { case: 'one upload', shown: notification(), headline: 'Night Kitchen uploaded a video' },
    {
      case: 'a group of uploads',
      shown: notification({}, { count: 3 }),
      headline: '3 new videos from Night Kitchen',
    },
    {
      case: 'one post',
      shown: notification({ kind: 'post', videoId: null }, { videoTitle: null }),
      headline: 'Night Kitchen shared a post',
    },
    {
      case: 'a group of posts',
      shown: notification({ kind: 'post', videoId: null }, { videoTitle: null, count: 3 }),
      headline: '3 new posts from Night Kitchen',
    },
    {
      case: 'a live start',
      shown: notification({ kind: 'live' }),
      headline: 'Night Kitchen is live now',
    },
    {
      case: 'a reply',
      shown: notification({ kind: 'reply' }),
      headline: 'Night Kitchen replied to your comment',
    },
    {
      case: 'a mention',
      shown: notification({ kind: 'mention' }),
      headline: 'Night Kitchen mentioned you',
    },
    {
      case: 'a comment',
      shown: notification({ kind: 'comment' }),
      headline: 'Night Kitchen commented on your video',
    },
    {
      case: 'a heart',
      shown: notification({ kind: 'heart' }),
      headline: 'Night Kitchen hearted your comment',
    },
    {
      case: 'a team invite',
      shown: notification({ kind: 'team_invite', videoId: null }, { videoTitle: null }),
      headline: 'Night Kitchen invited you to join their team',
    },
    ...(
      [
        ['playlist_invite', 'Night Kitchen invited you to work on the playlist Road trip'],
        ['playlist_update', 'Night Kitchen changed your playlist Road trip'],
      ] as const
    ).map(([kind, headline]) => ({
      case: `a ${kind}`,
      shown: notification(
        { kind, videoId: null },
        { videoTitle: null, playlist: { id: NOTIFICATION_ID, title: 'Road trip', invite: null } }
      ),
      headline,
    })),
    ...(['hold', 'hide', 'remove', 'ban'] as const).map((action) => ({
      case: `a visible ${action}`,
      shown: notification(
        { kind: 'moderation', videoId: null },
        { actor: null, moderation: { action, reason: null, expiresAt: null } }
      ),
      headline: {
        hold: 'Your comment is waiting for review',
        hide: 'Your comment was hidden',
        remove: 'Your comment was removed',
        ban: 'You can no longer comment on a channel',
      }[action],
    })),
    {
      case: 'a finished upload',
      shown: notification({ kind: 'processing' }, { actor: null, outcome: 'ready' }),
      headline: 'Your video is ready to watch',
    },
    {
      case: 'a failed upload',
      shown: notification({ kind: 'processing' }, { actor: null, outcome: 'failed' }),
      headline: 'Your video could not be processed',
    },
    {
      case: 'a video held by screening',
      shown: notification({ kind: 'processing' }, { actor: null, outcome: 'held' }),
      headline: 'Your video is on hold until a reviewer has looked at it',
    },
    {
      case: 'a video a reviewer approved',
      shown: notification({ kind: 'processing' }, { actor: null, outcome: 'approved' }),
      headline: 'A reviewer approved your video',
    },
    {
      case: 'a video a reviewer rejected',
      shown: notification({ kind: 'processing' }, { actor: null, outcome: 'rejected' }),
      headline: 'A reviewer rejected your video',
    },
    {
      case: 'an actor that is gone',
      shown: notification({ kind: 'reply' }, { actor: null }),
      headline: 'Someone replied to your comment',
    },
  ])('words $case', ({ shown, headline }) => {
    expect(textOf(shown).headline).toBe(headline);
  });

  it.each<{ case: string; shown: Notification; detail: string | null }>([
    { case: 'the video title', shown: notification(), detail: 'Midnight ramen' },
    {
      case: 'the comment over the title',
      shown: notification({ kind: 'reply' }, { excerpt: 'So good' }),
      detail: 'So good',
    },
    {
      case: 'the post text',
      shown: notification(
        { kind: 'post', videoId: null },
        { videoTitle: null, excerpt: 'Dinner at nine' }
      ),
      detail: 'Dinner at nine',
    },
    { case: 'nothing', shown: notification({}, { videoTitle: null }), detail: null },
  ])('details $case', ({ shown, detail }) => {
    expect(textOf(shown).detail).toBe(detail);
  });
});
