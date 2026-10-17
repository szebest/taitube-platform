import { representativeReports, summaryLine } from '../summary';

const reportOf = ({ score = 0.87, lcpMs = 2140.6, cls = 0.0123 } = {}) => ({
  categories: { performance: { score } },
  audits: {
    'largest-contentful-paint': { numericValue: lcpMs },
    'cumulative-layout-shift': { numericValue: cls },
  },
});

describe('packages/lighthouse: summary', () => {
  it('keeps the representative run of each URL', () => {
    const manifest = [
      { url: 'http://127.0.0.1:5431/', isRepresentativeRun: false, jsonPath: '/r/a.json' },
      { url: 'http://127.0.0.1:5431/', isRepresentativeRun: true, jsonPath: '/r/b.json' },
    ];

    expect(representativeReports(manifest)).toEqual([
      { url: 'http://127.0.0.1:5431/', isRepresentativeRun: true, jsonPath: '/r/b.json' },
    ]);
  });

  it('prints the performance score, LCP in seconds and CLS for a URL', () => {
    expect(summaryLine('http://127.0.0.1:5431/', reportOf())).toBe(
      'http://127.0.0.1:5431/  performance 87  LCP 2.14 s  CLS 0.012'
    );
  });

  it('refuses a report without the audits it prints', () => {
    expect(() => summaryLine('/', { categories: {}, audits: {} })).toThrow();
  });
});
