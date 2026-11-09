function isPlaying(doc: Document): boolean {
  return [...doc.querySelectorAll('video, audio')].some(
    (media) => media instanceof HTMLMediaElement && !media.paused && !media.ended
  );
}

/**
 * Reloads now, or, while a video or audio element is playing, as soon as the last one pauses or ends,
 * so an update never cuts off playback. Media events do not bubble, hence the capture listener.
 */
export function reloadWhenIdle(doc: Document, reload: () => void): void {
  if (!isPlaying(doc)) {
    reload();
    return;
  }

  const controller = new AbortController();
  const recheck = () => {
    if (isPlaying(doc)) {
      return;
    }

    controller.abort();
    reload();
  };
  doc.addEventListener('pause', recheck, { capture: true, signal: controller.signal });
  doc.addEventListener('ended', recheck, { capture: true, signal: controller.signal });
}
