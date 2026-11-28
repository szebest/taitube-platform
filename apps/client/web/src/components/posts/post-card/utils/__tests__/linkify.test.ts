import { linkify } from '../linkify';

describe('apps/client/web: linkify', () => {
  it.each([
    {
      name: 'plain text',
      text: 'No links here',
      parts: [{ kind: 'text', text: 'No links here', start: 0 }],
    },
    { name: 'an empty string', text: '', parts: [] },
    {
      name: 'a bare link',
      text: 'https://example.com/a?b=1',
      parts: [
        {
          kind: 'link',
          text: 'https://example.com/a?b=1',
          href: 'https://example.com/a?b=1',
          start: 0,
        },
      ],
    },
    {
      name: 'a link inside a sentence',
      text: 'See https://example.com for more',
      parts: [
        { kind: 'text', text: 'See ', start: 0 },
        { kind: 'link', text: 'https://example.com', href: 'https://example.com/', start: 4 },
        { kind: 'text', text: ' for more', start: 23 },
      ],
    },
    {
      name: 'a sentence-ending full stop',
      text: 'Read https://example.com/post.',
      parts: [
        { kind: 'text', text: 'Read ', start: 0 },
        {
          kind: 'link',
          text: 'https://example.com/post',
          href: 'https://example.com/post',
          start: 5,
        },
        { kind: 'text', text: '.', start: 29 },
      ],
    },
    {
      name: 'a link in brackets',
      text: '(https://example.com/x)',
      parts: [
        { kind: 'text', text: '(', start: 0 },
        { kind: 'link', text: 'https://example.com/x', href: 'https://example.com/x', start: 1 },
        { kind: 'text', text: ')', start: 22 },
      ],
    },
    {
      name: 'two links with a newline between',
      text: 'https://a.example\nhttps://b.example',
      parts: [
        { kind: 'link', text: 'https://a.example', href: 'https://a.example/', start: 0 },
        { kind: 'text', text: '\n', start: 17 },
        { kind: 'link', text: 'https://b.example', href: 'https://b.example/', start: 18 },
      ],
    },
    {
      name: 'an http link, which is not detected',
      text: 'http://example.com',
      parts: [{ kind: 'text', text: 'http://example.com', start: 0 }],
    },
    {
      name: 'a javascript link, which is not detected',
      text: 'javascript:alert(1)',
      parts: [{ kind: 'text', text: 'javascript:alert(1)', start: 0 }],
    },
    {
      name: 'a scheme with no host',
      text: 'https://',
      parts: [{ kind: 'text', text: 'https://', start: 0 }],
    },
    {
      name: 'markup, which stays text',
      text: '<a href="https://x.example">x</a>',
      parts: [{ kind: 'text', text: '<a href="https://x.example">x</a>', start: 0 }],
    },
  ] as const)('reads $name', ({ text, parts }) => {
    expect(linkify(text)).toEqual(parts);
  });
});
