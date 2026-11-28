import { expectErr, expectOk } from '@kit/testing/result';
import { validateRichText } from '../rich-text';

const IMAGE = '0195a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b';
const LIMITS = { maxChars: 8000, maxImages: 6 };

describe('@vp/validation: validateRichText', () => {
  it('accepts the whitelisted nodes and answers the page images it uses', () => {
    const body = [
      '## Welcome',
      '',
      'Some **bold**, some *italic* and a [link](https://example.com).  ',
      'A second line.',
      '',
      '- one',
      '- two',
      '',
      `![A banner](page-image:${IMAGE})`,
    ].join('\n');

    expect(expectOk(validateRichText(body, LIMITS))).toEqual([IMAGE]);
  });

  it.each([
    { scenario: 'HTML', body: '<b>bold</b> text', reason: 'html' },
    { scenario: 'a script', body: '<script>alert(1)</script>', reason: 'html' },
    {
      scenario: 'an image URL',
      body: '![x](https://example.com/a.png)',
      reason: 'image_reference',
    },
    {
      scenario: 'an image without alt text',
      body: `![](page-image:${IMAGE})`,
      reason: 'image_alt',
    },
    { scenario: 'a javascript link', body: '[x](javascript:alert(1))', reason: 'link_scheme' },
    { scenario: 'a plain http link', body: '[x](http://example.com)', reason: 'link_scheme' },
    { scenario: 'an h1', body: '# Title', reason: 'heading' },
    { scenario: 'a code block', body: '```\ncode\n```', reason: 'node' },
    { scenario: 'a quote', body: '> quoted', reason: 'node' },
    { scenario: 'a body over the limit', body: 'a'.repeat(8001), reason: 'too_long' },
    {
      scenario: 'seven images',
      body: Array.from({ length: 7 }, () => `![a](page-image:${IMAGE})`).join('\n\n'),
      reason: 'too_many_images',
    },
  ])('refuses $scenario', ({ body, reason }) => {
    expect(expectErr(validateRichText(body, LIMITS))).toMatchObject({
      code: 'LAYOUT_MARKDOWN_INVALID',
      reason,
    });
  });
});
