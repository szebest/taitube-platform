import type { PlaybackEvent } from '@vp/api-contracts';
import { createPlaybackTracker } from '../playback-tracker';

const VIDEO_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const SESSION = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const DURATION = 120;

function setup() {
  let time = 0;
  const events: PlaybackEvent[] = [];
  const tracker = createPlaybackTracker({
    videoId: VIDEO_ID,
    sessionUuid: SESSION,
    now: () => time,
    send: (event) => events.push(event),
  });
  const advance = (seconds: number) => {
    time += seconds * 1000;
  };
  const at = (currentTime: number) => ({ currentTime, duration: DURATION });
  return { tracker, events, advance, at };
}

const types = (events: PlaybackEvent[]) => events.map(({ eventType }) => eventType);

describe('createPlaybackTracker', () => {
  it('reports the start once, however many times playback resumes', () => {
    const { tracker, events, at } = setup();

    tracker.play(at(0));
    tracker.pause(at(0));
    tracker.play(at(0));

    expect(events).toEqual([
      expect.objectContaining({
        videoId: VIDEO_ID,
        sessionUuid: SESSION,
        eventType: 'playback_start',
        currentTime: 0,
        duration: DURATION,
      }),
    ]);
  });

  it('sends a heartbeat for each 30 seconds of active playback, with the segment watched', () => {
    const { tracker, events, advance, at } = setup();

    tracker.play(at(0));
    advance(29);
    tracker.timeUpdate(at(29));
    advance(2);
    tracker.timeUpdate(at(31));

    expect(types(events)).toEqual(['playback_start', 'heartbeat']);
    expect(events[1]).toMatchObject({ currentTime: 31, watchedSeconds: 31, rebufferingMs: 0 });
  });

  it('sends the unreported segment when playback pauses, and counts nothing while paused', () => {
    const { tracker, events, advance, at } = setup();

    tracker.play(at(0));
    advance(10);
    tracker.pause(at(10));
    advance(60);
    tracker.play(at(10));
    advance(5);
    tracker.pause(at(15));

    expect(events.slice(1).map(({ watchedSeconds }) => watchedSeconds)).toEqual([10, 5]);
  });

  it('stops counting while the page is hidden and resumes when it shows again', () => {
    const { tracker, events, advance, at } = setup();

    tracker.play(at(0));
    advance(8);
    tracker.visibility(false);
    advance(300);
    tracker.visibility(true);
    advance(2);
    tracker.pause(at(10));

    expect(
      events.slice(1).map(({ eventType, watchedSeconds }) => [eventType, watchedSeconds])
    ).toEqual([
      ['heartbeat', 8],
      ['heartbeat', 2],
    ]);
  });

  it('measures a stall as rebuffering, not as watch time, and reports it when playback recovers', () => {
    const { tracker, events, advance, at } = setup();

    tracker.play(at(0));
    advance(20);
    tracker.timeUpdate(at(20));
    tracker.waiting();
    advance(3);
    tracker.play(at(20));

    expect(events.at(-1)).toMatchObject({
      eventType: 'rebuffer',
      rebufferingMs: 3000,
      watchedSeconds: 20,
    });
  });

  it('reports the rendition after the start, and a change of it', () => {
    const { tracker, events, at } = setup();

    tracker.rendition('1080p');
    tracker.play(at(0));
    tracker.rendition('720p');
    tracker.rendition('720p');

    expect(events.map(({ eventType, rendition }) => [eventType, rendition])).toEqual([
      ['playback_start', '1080p'],
      ['quality_change', '720p'],
    ]);
  });

  it('ends the session with the last segment and sends nothing more', () => {
    const { tracker, events, advance, at } = setup();

    tracker.play(at(0));
    advance(120);
    tracker.end(at(120));
    tracker.dispose();

    expect(events.at(-1)).toMatchObject({
      eventType: 'playback_ended',
      currentTime: 120,
      watchedSeconds: 120,
    });
    expect(events).toHaveLength(2);
  });

  it('flushes what was watched when the player unmounts mid-video', () => {
    const { tracker, events, advance, at } = setup();

    tracker.play(at(0));
    advance(4);
    tracker.dispose();

    expect(events.at(-1)).toMatchObject({ eventType: 'heartbeat', watchedSeconds: 4 });
  });

  it('sends nothing before the video reports a duration', () => {
    const { tracker, events } = setup();

    tracker.play({ currentTime: 0, duration: Number.NaN });

    expect(events).toEqual([]);
  });
});
