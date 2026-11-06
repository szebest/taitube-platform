import { showCues } from '../text-tracks';

function videoWithTrack() {
  const video = document.createElement('video');
  const element = document.createElement('track');
  element.id = 'en';
  element.kind = 'captions';
  element.srclang = 'en';
  video.append(element);
  document.body.append(video);
  return { video, element };
}

describe('@vp/web-testing: text tracks', () => {
  it('lists the track of each <track> child under its id, language and kind', () => {
    const { video } = videoWithTrack();

    expect(
      [...video.textTracks].map(({ id, language, kind, mode }) => ({ id, language, kind, mode }))
    ).toEqual([{ id: 'en', language: 'en', kind: 'captions', mode: 'disabled' }]);
  });

  it('announces a track added after the list was read', async () => {
    const { video } = videoWithTrack();
    const added = vi.fn();
    video.textTracks.addEventListener('addtrack', added);

    const late = document.createElement('track');
    late.id = 'pl';
    video.append(late);

    await vi.waitFor(() => expect(added).toHaveBeenCalledTimes(1));
    expect(video.textTracks.getTrackById('pl')).toBe(late.track);
  });

  it('puts cues at the playhead and tells the track', () => {
    const { video, element } = videoWithTrack();
    const changed = vi.fn();
    element.track.addEventListener('cuechange', changed);

    showCues(video, 'en', ['Hello']);

    expect(changed).toHaveBeenCalledTimes(1);
    expect(
      Array.from(element.track.activeCues ?? [], (cue) =>
        cue instanceof VTTCue ? cue.getCueAsHTML().textContent : ''
      )
    ).toEqual(['Hello']);
  });
});
