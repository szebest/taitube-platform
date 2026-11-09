import { observePageHealth } from '../observe-page-health';

type Observer = (list: { getEntries: () => PerformanceEntryList }) => void;

const observers = new Map<string, Observer>();

class FakePerformanceObserver {
  static supportedEntryTypes: string[] = [];

  constructor(private readonly callback: Observer) {}

  observe({ type }: { type: string }) {
    observers.set(type, this.callback);
  }
}

const slot = (name: string) => {
  const element = document.createElement('div');
  element.dataset['slot'] = name;
  const inner = document.createElement('span');
  element.append(inner);
  return inner;
};

const emit = (type: string, entries: object[]) =>
  observers.get(type)?.({ getEntries: () => entries as PerformanceEntryList });

describe('observePageHealth', () => {
  beforeEach(() => {
    FakePerformanceObserver.supportedEntryTypes = ['longtask', 'layout-shift'];
    vi.stubGlobal('PerformanceObserver', FakePerformanceObserver);
  });

  afterEach(() => {
    observers.clear();
    vi.unstubAllGlobals();
  });

  it('adds up the long tasks', () => {
    const health = observePageHealth();

    emit('longtask', [{ duration: 80 }, { duration: 120 }]);
    emit('longtask', [{ duration: 60 }]);

    expect(health.longTaskMs()).toBe(260);
  });

  it('names the slot of the element that moved in the largest shift', () => {
    const health = observePageHealth();

    emit('layout-shift', [
      { value: 0.01, hadRecentInput: false, sources: [{ node: slot('video-card') }] },
      { value: 0.09, hadRecentInput: false, sources: [{ node: slot('install-prompt') }] },
      { value: 0.5, hadRecentInput: true, sources: [{ node: slot('button') }] },
      { value: 0.02, hadRecentInput: false, sources: [{ node: slot('chip') }] },
    ]);

    expect(health.largestShiftSource()).toBe('install-prompt');
  });

  it('has no source for a shift with no node, or a page that never shifted', () => {
    const health = observePageHealth();

    expect(health.largestShiftSource()).toBeUndefined();

    emit('layout-shift', [{ value: 0.2, hadRecentInput: false, sources: [] }]);

    expect(health.largestShiftSource()).toBeUndefined();
  });

  it('measures nothing in a browser without the entry types', () => {
    FakePerformanceObserver.supportedEntryTypes = [];

    const health = observePageHealth();

    expect(observers.size).toBe(0);
    expect(health.longTaskMs()).toBe(0);
  });
});
