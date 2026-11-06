class ShimCue {
  readonly startTime: number;
  readonly endTime: number;
  readonly text: string;

  constructor(startTime: number, endTime: number, text: string) {
    this.startTime = startTime;
    this.endTime = endTime;
    this.text = text;
  }

  getCueAsHTML(): DocumentFragment {
    const fragment = document.createDocumentFragment();
    fragment.append(this.text);
    return fragment;
  }
}

class ShimTextTrack extends EventTarget {
  readonly #element: HTMLTrackElement;
  mode: TextTrackMode = 'disabled';
  #activeCues: readonly ShimCue[] | null = null;

  constructor(element: HTMLTrackElement) {
    super();
    this.#element = element;
  }

  get id() {
    return this.#element.id;
  }

  get kind() {
    return this.#element.kind;
  }

  get language() {
    return this.#element.srclang;
  }

  get label() {
    return this.#element.label;
  }

  get activeCues() {
    return this.#activeCues;
  }

  showCues(texts: readonly string[]) {
    this.#activeCues = texts.map((text, index) => new ShimCue(index, index + 1, text));
    this.dispatchEvent(new Event('cuechange'));
  }
}

const INDEX = /^\d+$/;

/** The text tracks of a media element's `<track>` children, announcing each one added as the browser does. */
class ShimTextTrackList extends EventTarget {
  private readonly media: HTMLMediaElement;
  private readonly trackOf: (element: HTMLTrackElement) => ShimTextTrack;
  private readonly announced = new WeakSet<HTMLTrackElement>();

  constructor(media: HTMLMediaElement, trackOf: (element: HTMLTrackElement) => ShimTextTrack) {
    super();
    this.media = media;
    this.trackOf = trackOf;
    const observer = new MutationObserver(() => this.announce());
    observer.observe(media, { childList: true });
    this.announce();
  }

  tracks(): ShimTextTrack[] {
    return [...this.media.querySelectorAll('track')].map(this.trackOf);
  }

  private announce() {
    for (const element of this.media.querySelectorAll('track')) {
      if (!this.announced.has(element)) {
        this.announced.add(element);
        this.dispatchEvent(new Event('addtrack'));
      }
    }
  }

  get length() {
    return this.tracks().length;
  }

  getTrackById(id: string): ShimTextTrack | null {
    return this.tracks().find((track) => track.id === id) ?? null;
  }

  [Symbol.iterator]() {
    return this.tracks()[Symbol.iterator]();
  }
}

/** The list a browser gives, which also reads by index. */
function indexedTextTrackList(
  media: HTMLMediaElement,
  trackOf: (element: HTMLTrackElement) => ShimTextTrack
): ShimTextTrackList {
  return new Proxy(new ShimTextTrackList(media, trackOf), {
    get: (target, property) => {
      if (typeof property === 'string' && INDEX.test(property)) {
        return target.tracks()[Number(property)];
      }

      const value: unknown = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

/**
 * jsdom has no text tracks: this gives every media element a list of its `<track>` children and
 * `VTTCue`, so a spec drives captions the way a browser would.
 */
export function installTextTracks(): void {
  const tracks = new WeakMap<HTMLTrackElement, ShimTextTrack>();
  const lists = new WeakMap<HTMLMediaElement, ShimTextTrackList>();
  const trackOf = (element: HTMLTrackElement) => {
    const known = tracks.get(element);
    if (known) {
      return known;
    }

    const created = new ShimTextTrack(element);
    tracks.set(element, created);
    return created;
  };

  Object.defineProperty(HTMLMediaElement.prototype, 'textTracks', {
    configurable: true,
    get(this: HTMLMediaElement) {
      const known = lists.get(this);
      if (known) {
        return known;
      }

      const created = indexedTextTrackList(this, trackOf);
      lists.set(this, created);
      return created;
    },
  });
  Object.defineProperty(HTMLTrackElement.prototype, 'track', {
    configurable: true,
    get(this: HTMLTrackElement) {
      return trackOf(this);
    },
  });
  Object.defineProperty(window, 'VTTCue', { configurable: true, writable: true, value: ShimCue });
}

/** Puts the cues of the `<track id>` at the playhead, as a browser does when playback reaches them. */
export function showCues(media: HTMLMediaElement, id: string, texts: readonly string[]): void {
  const element = media.querySelector<HTMLTrackElement>(`track[id="${id}"]`);
  if (!element) {
    throw new Error(`no <track id="${id}"> in the media element`);
  }

  const { track } = element;
  if (!(track instanceof ShimTextTrack)) {
    throw new TypeError('text tracks are not installed: run installTextTracks() first');
  }

  track.showCues(texts);
}
