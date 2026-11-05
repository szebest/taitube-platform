import type { Page } from '@playwright/test';

export const CLS_BUDGET = 0.05;

type LayoutShift = PerformanceEntry & { value: number; hadRecentInput: boolean };
type LargestPaint = PerformanceEntry & { element: Element | null; size: number };

interface Vitals {
  lcp: { slot: string | null; size: number } | undefined;
  cls: number;
}

export const observeVitals = (page: Page) =>
  page.addInitScript(() => {
    const vitals: Vitals = { lcp: undefined, cls: 0 };
    Object.assign(window, { vitals });
    new PerformanceObserver((list) => {
      const entry = list.getEntries().at(-1) as LargestPaint;
      vitals.lcp = { slot: entry.element?.getAttribute('data-slot') ?? null, size: entry.size };
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as LayoutShift[]) {
        if (!entry.hadRecentInput) {
          vitals.cls += entry.value;
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });

export const readVitals = (page: Page) =>
  page.evaluate(() => (window as unknown as { vitals: Vitals }).vitals);
