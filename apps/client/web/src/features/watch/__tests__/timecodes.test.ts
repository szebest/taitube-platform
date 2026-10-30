import { chaptersOf, tokenizeDescription } from '../timecodes';

describe('apps/client/web: description timecodes', () => {
  it.each([
    {
      scenario: 'no timecode',
      description: 'Shot on Hi8.',
      tokens: [{ type: 'text', text: 'Shot on Hi8.', start: 0 }],
    },
    {
      scenario: 'minutes and seconds',
      description: 'See 02:15 for the tram',
      tokens: [
        { type: 'text', text: 'See ', start: 0 },
        { type: 'time', text: '02:15', start: 4, seconds: 135 },
        { type: 'text', text: ' for the tram', start: 9 },
      ],
    },
    {
      scenario: 'hours',
      description: '1:02:03',
      tokens: [{ type: 'time', text: '1:02:03', start: 0, seconds: 3723 }],
    },
    {
      scenario: 'seconds past 59',
      description: 'at 00:75',
      tokens: [{ type: 'text', text: 'at 00:75', start: 0 }],
    },
    {
      scenario: 'minutes past 59 beside an hour',
      description: '1:75:00',
      tokens: [{ type: 'text', text: '1:75:00', start: 0 }],
    },
    {
      scenario: 'a link, which keeps its trailing punctuation out',
      description: 'Gear: https://example.com/hi8.',
      tokens: [
        { type: 'text', text: 'Gear: ', start: 0 },
        {
          type: 'link',
          text: 'https://example.com/hi8',
          start: 6,
          href: 'https://example.com/hi8',
        },
        { type: 'text', text: '.', start: 29 },
      ],
    },
    {
      scenario: 'a timecode inside a link',
      description: 'https://example.com/?t=12:34:56',
      tokens: [
        {
          type: 'link',
          text: 'https://example.com/?t=12:34:56',
          start: 0,
          href: 'https://example.com/?t=12:34:56',
        },
      ],
    },
  ])('tokenises $scenario', ({ description, tokens }) => {
    expect(tokenizeDescription(description)).toEqual(tokens);
  });

  it.each([
    {
      scenario: 'a list opening at zero',
      description: '00:00 Arrival\n02:15 - The tram\n1:06:40: Rain',
      chapters: [
        { seconds: 0, title: 'Arrival' },
        { seconds: 135, title: 'The tram' },
        { seconds: 4000, title: 'Rain' },
      ],
    },
    {
      scenario: 'indented lines among prose',
      description: 'Chapters\n  00:00 Start\nsome words\n  01:00 End',
      chapters: [
        { seconds: 0, title: 'Start' },
        { seconds: 60, title: 'End' },
      ],
    },
    { scenario: 'a single timecode', description: '00:00 Start', chapters: [] },
    {
      scenario: 'a list that does not start at zero',
      description: '00:05 A\n01:00 B',
      chapters: [],
    },
    {
      scenario: 'timecodes in the middle of a line',
      description: 'a 00:00 b\nc 01:00 d',
      chapters: [],
    },
    {
      scenario: 'timecodes that do not rise',
      description: '00:00 A\n02:00 B\n01:00 C',
      chapters: [],
    },
    { scenario: 'no description text', description: '', chapters: [] },
  ])('lists the chapters of $scenario', ({ description, chapters }) => {
    expect(chaptersOf(description)).toEqual(chapters);
  });
});
