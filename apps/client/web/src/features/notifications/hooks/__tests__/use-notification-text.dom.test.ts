import { renderHook } from '@testing-library/react';
import type { Notification } from '@vp/api-contracts';
import { AppProviders } from '#app/__tests__/providers';
import { notification } from '../../__tests__/notification-fixtures';
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
    { case: 'nothing', shown: notification({}, { videoTitle: null }), detail: null },
  ])('details $case', ({ shown, detail }) => {
    expect(textOf(shown).detail).toBe(detail);
  });
});
