import { bearerOf, carriesApiToken } from '../bearer';

describe('apps/server/api/plugins: bearer', () => {
  it.each([
    { header: 'Bearer abc.def', credential: 'abc.def' },
    { header: 'Bearer  spaced ', credential: 'spaced' },
    { header: 'Basic dXNlcg==', credential: null },
    { header: 'Bearer ', credential: null },
    { header: undefined, credential: null },
  ])('reads $header as $credential', ({ header, credential }) => {
    expect(bearerOf(header)).toBe(credential);
  });

  it.each([
    { header: 'Bearer tt_pat_0a1b2c3d_ff', carries: true },
    { header: 'Bearer tt_pat_garbage', carries: true },
    { header: 'Bearer eyJhbGciOiJSUzI1NiJ9.e30.sig', carries: false },
    { header: 'tt_pat_0a1b2c3d_ff', carries: false },
    { header: undefined, carries: false },
  ])('tells a token in $header: $carries', ({ header, carries }) => {
    expect(carriesApiToken(header)).toBe(carries);
  });
});
