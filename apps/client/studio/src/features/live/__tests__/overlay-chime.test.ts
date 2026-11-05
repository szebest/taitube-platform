import { type ChimeContext, playChime } from '../overlay-chime';

interface Note {
  hz: number | undefined;
  startedAt: number | undefined;
  stoppedAt: number | undefined;
  connectedTo: unknown;
  onended: ((event: Event) => void) | null;
}

function fakeContext() {
  const notes: Note[] = [];
  const closed = vi.fn();
  const destination = { name: 'speakers' };
  const param = () => ({ setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
  const context: ChimeContext = {
    currentTime: 2,
    destination,
    close: closed,
    createGain: () => ({ gain: param(), connect: vi.fn() }),
    createOscillator: () => {
      const note: Note = {
        hz: undefined,
        startedAt: undefined,
        stoppedAt: undefined,
        connectedTo: undefined,
        onended: null,
      };
      notes.push(note);
      const frequency = {
        setValueAtTime: (hz: number) => {
          note.hz = hz;
        },
        exponentialRampToValueAtTime: vi.fn(),
      };
      return {
        type: 'square',
        frequency,
        get onended() {
          return note.onended;
        },
        set onended(handler) {
          note.onended = handler;
        },
        connect: vi.fn(),
        start: (at: number) => {
          note.startedAt = at;
        },
        stop: (at: number) => {
          note.stoppedAt = at;
        },
      };
    },
  };
  return { context, notes, closed };
}

describe('apps/client/studio: playChime', () => {
  it('plays two rising notes one after the other from the context clock', () => {
    const { context, notes } = fakeContext();

    playChime(() => context);

    expect(notes.map(({ hz }) => hz)).toEqual([880, 1318.5]);
    expect(notes.map(({ startedAt }) => startedAt)).toEqual([2, 2.15]);
    expect(notes.every(({ stoppedAt, startedAt }) => (stoppedAt ?? 0) > (startedAt ?? 0))).toBe(
      true
    );
  });

  it('closes the context once the last note has ended', () => {
    const { context, notes, closed } = fakeContext();

    playChime(() => context);
    expect(closed).not.toHaveBeenCalled();
    notes.at(-1)?.onended?.(new Event('ended'));

    expect(closed).toHaveBeenCalledOnce();
  });

  it('stays silent when the browser cannot open an audio context', () => {
    expect(() =>
      playChime(() => {
        throw new Error('blocked');
      })
    ).not.toThrow();
  });
});
