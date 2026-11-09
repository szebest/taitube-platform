import { reloadWhenIdle } from '../reload-when-idle';

function addVideo(playing: boolean): HTMLVideoElement {
  const video = document.createElement('video');
  Object.defineProperty(video, 'paused', { value: !playing, configurable: true });
  document.body.append(video);
  return video;
}

describe('apps/client/web: reloadWhenIdle', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('reloads at once when nothing is playing', () => {
    const reload = vi.fn();
    addVideo(false);

    reloadWhenIdle(document, reload);

    expect(reload).toHaveBeenCalledOnce();
  });

  it.each(['pause', 'ended'])('waits for the playing video, then reloads on %s', (eventName) => {
    const reload = vi.fn();
    const video = addVideo(true);

    reloadWhenIdle(document, reload);
    expect(reload).not.toHaveBeenCalled();

    Object.defineProperty(video, 'paused', { value: true });
    video.dispatchEvent(new Event(eventName));
    video.dispatchEvent(new Event(eventName));

    expect(reload).toHaveBeenCalledOnce();
  });

  it('keeps waiting while another video still plays', () => {
    const reload = vi.fn();
    const first = addVideo(true);
    addVideo(true);

    reloadWhenIdle(document, reload);
    Object.defineProperty(first, 'paused', { value: true });
    first.dispatchEvent(new Event('pause'));

    expect(reload).not.toHaveBeenCalled();
  });
});
