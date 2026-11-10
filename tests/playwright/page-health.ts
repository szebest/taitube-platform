import type { Page } from '@playwright/test';
import type { PageHealth } from '../../scripts/perf-clicks/page-health';

type LayoutShiftSource = { node: Node | null };
type LayoutShift = PerformanceEntry & {
  value: number;
  hadRecentInput: boolean;
  sources: LayoutShiftSource[];
};
type InteractionTiming = PerformanceEntry & { interactionId: number; target: Element | null };

/** Counts the shifts, long tasks and interactions of every page the context opens, for `readPageHealth`. */
export const observePageHealth = (page: Page) =>
  page.addInitScript(() => {
    const health: PageHealth = {
      cls: 0,
      shifts: [],
      longTasks: { count: 0, ms: 0 },
      interactions: [],
    };
    Object.assign(window, { pageHealth: health });

    const describe = (node: Node | null) => {
      const element = node instanceof Element ? node : (node?.parentElement ?? null);
      const slot = element?.closest('[data-slot]')?.getAttribute('data-slot');
      return slot ?? element?.tagName.toLowerCase() ?? 'unknown';
    };

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as LayoutShift[]) {
        if (entry.hadRecentInput) continue;
        health.cls += entry.value;
        health.shifts.push({
          value: entry.value,
          source: describe(entry.sources[0]?.node ?? null),
        });
      }
    }).observe({ type: 'layout-shift', buffered: true });

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        health.longTasks.count += 1;
        health.longTasks.ms += entry.duration;
      }
    }).observe({ type: 'longtask', buffered: true });

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as InteractionTiming[]) {
        if (entry.interactionId > 0) {
          health.interactions.push({
            type: entry.name,
            target: describe(entry.target),
            duration: entry.duration,
          });
        }
      }
    }).observe({ type: 'event', durationThreshold: 16, buffered: true } as PerformanceObserverInit);
  });

export const readPageHealth = (page: Page) =>
  page.evaluate(() => (window as unknown as { pageHealth: PageHealth }).pageHealth);
