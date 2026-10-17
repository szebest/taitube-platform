import type { Span, SpanProcessor } from '@opentelemetry/sdk-trace-web';

const URL_ATTRIBUTES = ['http.url', 'url.full'];

/** A query string can carry what a viewer typed, such as a search, so a span keeps the path only. */
export const dropUrlQuery: SpanProcessor = {
  onStart(span: Span) {
    for (const attribute of URL_ATTRIBUTES) {
      const value = span.attributes[attribute];
      if (typeof value !== 'string') {
        continue;
      }

      const url = new URL(value);
      url.search = '';
      span.setAttribute(attribute, url.href);
    }
  },
  onEnd: () => undefined,
  forceFlush: async () => undefined,
  shutdown: async () => undefined,
};
