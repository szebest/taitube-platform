import type { VoiceEngine, VoiceEngineEvent } from '../voice-port';

/** A voice engine that records what it was told and lets a spec say who speaks or drop the connection. */
export function fakeVoiceEngine() {
  const listeners = new Set<(event: VoiceEngineEvent) => void>();
  const engine = {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    setMicEnabled: vi.fn(async () => undefined),
    setCapture: vi.fn(async () => undefined),
    setVolume: vi.fn(),
    setSubscribed: vi.fn(),
    listDevices: vi.fn(async () => ({ inputs: [], outputs: [], canSelectOutput: false })),
    selectInput: vi.fn(async () => undefined),
    selectOutput: vi.fn(async () => undefined),
    inputLevel: vi.fn(() => 0),
    subscribe: (listener: (event: VoiceEngineEvent) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } satisfies VoiceEngine;

  const emit = (event: VoiceEngineEvent) => {
    for (const listener of listeners) listener(event);
  };

  return { engine, emit };
}
