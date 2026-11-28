import { act, renderHook } from '@testing-library/react';
import { stubEventSource } from '@vp/web-testing/dom';
import { useWatchPartyDiscoveryEvents } from '../use-watch-party-discovery-events';

const ROOM_ID = '0190c3a0-5e1d-7000-8000-00000000e001';

function renderEvents() {
  const source = stubEventSource();
  const heard: unknown[] = [];
  const status: boolean[] = [];
  const rendered = renderHook(() =>
    useWatchPartyDiscoveryEvents(
      (event) => heard.push(event),
      (live) => status.push(live)
    )
  );
  return { ...rendered, source, heard, status };
}

describe('packages/queries: useWatchPartyDiscoveryEvents', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("listens to discovery's stream through the app's /api and hands on each frame it can read", () => {
    const { source, heard } = renderEvents();

    act(() => source.emit('party.closed', { type: 'party.closed', payload: { id: ROOM_ID } }));
    act(() => source.emit('party.closed', { nonsense: true }));

    expect(source.urls).toEqual(['/api/v1/watch-parties/events']);
    expect(heard).toEqual([{ type: 'party.closed', payload: { id: ROOM_ID } }]);
  });

  it('reports the stream open, then broken', () => {
    const { source, status } = renderEvents();

    act(() => source.emit('open', {}));
    act(() => source.emit('error', {}));

    expect(status).toEqual([true, false]);
  });

  it('opens nothing while the page is hidden', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');

    const { source, status } = renderEvents();

    expect(source.urls).toEqual([]);
    expect(status).toEqual([false]);
  });
});
