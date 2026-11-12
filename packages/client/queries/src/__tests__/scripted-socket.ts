type Listener = (event: Event) => void;

/** A `WebSocket` the spec drives: it opens, speaks and closes only when told to. */
class ScriptedSocket {
  static readonly OPEN = 1;
  readyState = 0;
  readonly sent: unknown[] = [];
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(readonly url: string) {}

  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, (this.listeners.get(type) ?? new Set()).add(listener));
  }

  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }

  close(): void {
    this.readyState = 3;
  }

  open(): void {
    this.readyState = ScriptedSocket.OPEN;
    this.dispatch(new Event('open'));
  }

  speak(frame: object): void {
    this.dispatch(new MessageEvent('message', { data: JSON.stringify(frame) }));
  }

  drop(): void {
    this.readyState = 3;
    this.dispatch(new Event('close'));
  }

  private dispatch(event: Event): void {
    for (const listener of this.listeners.get(event.type) ?? []) listener(event);
  }
}

/** Puts `ScriptedSocket` in place of `WebSocket`; `sockets` lists every one the page opened. */
export function scriptSockets() {
  const sockets: ScriptedSocket[] = [];
  vi.stubGlobal(
    'WebSocket',
    class extends ScriptedSocket {
      constructor(url: string) {
        super(url);
        sockets.push(this);
      }
    }
  );
  return sockets;
}
