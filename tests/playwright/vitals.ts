import type { Page } from '@playwright/test';

export const CLS_BUDGET = 0.05;

type LayoutShift = PerformanceEntry & {
  value: number;
  hadRecentInput: boolean;
  sources: { node: Node | null; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[];
};
type LargestPaint = PerformanceEntry & { url: string; size: number };

interface Shift {
  value: number;
  startTime: number;
  hadRecentInput: boolean;
  sources: { node: string; previousRect: unknown; currentRect: unknown }[];
}

interface Vitals {
  shifts: Shift[];
  lcp: { url: string; size: number } | undefined;
  cls: number;
}

export const observeVitals = (page: Page) =>
  page.addInitScript(() => {
    const vitals: Vitals = { lcp: undefined, cls: 0, shifts: [] };
    Object.assign(window, { vitals });
    new PerformanceObserver((list) => {
      const entry = list.getEntries().at(-1) as LargestPaint;
      vitals.lcp = { url: entry.url, size: entry.size };
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as LayoutShift[]) {
        const describe = (node: Node | null) => {
          if (!(node instanceof Element)) return String(node?.nodeName ?? null);
          const text = (node.textContent ?? '').slice(0, 60);
          return `${node.tagName.toLowerCase()}#${node.id}[data-slot=${node.getAttribute('data-slot')}] ${text}`;
        };
        vitals.shifts.push({
          value: entry.value,
          startTime: entry.startTime,
          hadRecentInput: entry.hadRecentInput,
          sources: entry.sources.map((source) => ({
            node: describe(source.node),
            previousRect: source.previousRect.toJSON(),
            currentRect: source.currentRect.toJSON(),
          })),
        });
        if (!entry.hadRecentInput) {
          vitals.cls += entry.value;
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });

export const readVitals = (page: Page) =>
  page.evaluate(() => (window as unknown as { vitals: Vitals }).vitals);
