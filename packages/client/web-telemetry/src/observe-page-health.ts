type LayoutShiftEntry = PerformanceEntry & {
  value: number;
  hadRecentInput: boolean;
  sources?: ReadonlyArray<{ node: Node | null }>;
};

export interface PageHealth {
  /** The milliseconds of every long task the page has run, so far. */
  longTaskMs: () => number;
  /** The `data-slot` of the element that moved in the largest layout shift of the page, if any. */
  largestShiftSource: () => string | undefined;
}

const slotOf = (node: Node | null | undefined) => {
  const element = node instanceof Element ? node : node?.parentElement;
  return element?.closest('[data-slot]')?.getAttribute('data-slot') ?? undefined;
};

function observe(type: string, onEntries: (entries: PerformanceEntryList) => void) {
  if (!PerformanceObserver.supportedEntryTypes?.includes(type)) {
    return;
  }

  new PerformanceObserver((list) => onEntries(list.getEntries())).observe({
    type,
    buffered: true,
  });
}

/** Watches the page's long tasks and layout shifts for the vitals that need an answer to "what", not only "how much". */
export function observePageHealth(): PageHealth {
  let longTaskMs = 0;
  let largest = { value: 0, source: undefined as string | undefined };

  observe('longtask', (entries) => {
    for (const { duration } of entries) {
      longTaskMs += duration;
    }
  });

  observe('layout-shift', (entries) => {
    for (const entry of entries as LayoutShiftEntry[]) {
      if (!entry.hadRecentInput && entry.value > largest.value) {
        largest = { value: entry.value, source: slotOf(entry.sources?.[0]?.node) };
      }
    }
  });

  return { longTaskMs: () => longTaskMs, largestShiftSource: () => largest.source };
}
