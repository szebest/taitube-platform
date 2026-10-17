import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  WebTracerProvider,
} from '@opentelemetry/sdk-trace-web';
import { dropUrlQuery } from '../drop-url-query';

const exportedAttributes = (attributes: Record<string, string | number>) => {
  const exporter = new InMemorySpanExporter();
  const provider = new WebTracerProvider({
    spanProcessors: [dropUrlQuery, new SimpleSpanProcessor(exporter)],
  });

  provider.getTracer('spec').startSpan('GET', { attributes }).end();

  return exporter.getFinishedSpans()[0]?.attributes;
};

describe('dropUrlQuery', () => {
  it.each(['http.url', 'url.full'])(
    'keeps the path of %s and drops what the viewer typed',
    (key) => {
      expect(
        exportedAttributes({ [key]: 'http://localhost:3000/v1/search?q=private+words' })
      ).toEqual({
        [key]: 'http://localhost:3000/v1/search',
      });
    }
  );

  it('leaves every other attribute as it was', () => {
    expect(exportedAttributes({ 'http.method': 'GET', 'http.status_code': 200 })).toEqual({
      'http.method': 'GET',
      'http.status_code': 200,
    });
  });
});
