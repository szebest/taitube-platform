import { describeLocalesContract } from '@kit/intl/contract';
import { LOCALES } from '../locales';

describe('@vp/shared-messages: the supported locales', () => {
  it.each([
    { tag: 'pl', supported: true },
    { tag: 'en', supported: true },
    { tag: 'pl-PL', supported: false },
    { tag: 'de', supported: false },
  ])('calls $tag supported: $supported', ({ tag, supported }) => {
    expect(LOCALES.isSupported(tag)).toBe(supported);
  });
});

describeLocalesContract(() => LOCALES);
