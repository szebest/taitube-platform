import { contextFor } from '../../__tests__/fixtures';
import { createIntl } from '../../create-intl';
import { resolution } from '../resolution';

describe('@vp/intl: resolution', () => {
  it('is an ungrouped number value', () => {
    expect(resolution(2160)).toEqual({
      type: 'number',
      value: 2160,
      options: { useGrouping: false },
    });
  });

  it.each(['en', 'de'])('never groups a height in %s', (locale) => {
    expect(createIntl(contextFor(locale)).format(resolution(2160))).toEqual({
      ok: true,
      value: '2160',
    });
  });
});
