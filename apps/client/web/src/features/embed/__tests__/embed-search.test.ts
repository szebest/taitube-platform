import { EmbedSearchSchema } from '../embed-search';

describe('apps/client/web: EmbedSearchSchema', () => {
  it.each([
    { search: {}, parsed: {} },
    { search: { autoplay: '1' }, parsed: { autoplay: 1 } },
    { search: { autoplay: 1 }, parsed: { autoplay: 1 } },
    { search: { autoplay: '0' }, parsed: {} },
    { search: { autoplay: 'yes' }, parsed: {} },
    { search: { t: '120' }, parsed: { t: 120 } },
    { search: { t: '0' }, parsed: { t: 0 } },
    { search: { t: 'soon' }, parsed: {} },
    { search: { t: '-5' }, parsed: {} },
    { search: { t: '1.5' }, parsed: {} },
    { search: { controls: '0' }, parsed: { controls: 0 } },
    { search: { controls: '1' }, parsed: {} },
    { search: { controls: 'none' }, parsed: {} },
    { search: { loop: '1' }, parsed: { loop: 1 } },
    { search: { loop: ['1', '0'] }, parsed: {} },
    { search: { autoplay: '1', t: '30', controls: '0', loop: '1' }, parsed: { autoplay: 1, t: 30, controls: 0, loop: 1 } },
  ])('reads $search as $parsed and never throws', ({ search, parsed }) => {
    expect(EmbedSearchSchema.parse(search)).toEqual({
      autoplay: undefined,
      t: undefined,
      controls: undefined,
      loop: undefined,
      ...parsed,
    });
  });
});
