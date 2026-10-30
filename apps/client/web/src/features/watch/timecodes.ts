const TIMECODE = /(?:(\d{1,2}):)?(\d{2}):(\d{2})/g;
const LINK = /https?:\/\/[^\s<>]+/g;
const TRAILING_PUNCTUATION = /[.,;:!?)]+$/;
const LEADING_SEPARATORS = /^[\s\-–—:|]+/;

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

interface TokenBase {
  text: string;
  /** Where the token starts in the description, which also keys it. */
  start: number;
}

export type DescriptionToken =
  | (TokenBase & { type: 'text' })
  | (TokenBase & { type: 'link'; href: string })
  | (TokenBase & { type: 'time'; seconds: number });

export interface Chapter {
  seconds: number;
  title: string;
}

function secondsOf(
  hours: string | undefined,
  minutes: string,
  seconds: string
): number | undefined {
  const parsed = Number(seconds);
  if (parsed >= SECONDS_PER_MINUTE) return undefined;
  if (hours !== undefined && Number(minutes) >= SECONDS_PER_MINUTE) return undefined;

  return Number(hours ?? 0) * SECONDS_PER_HOUR + Number(minutes) * SECONDS_PER_MINUTE + parsed;
}

type LinkToken = Extract<DescriptionToken, { type: 'link' }>;
type TimeToken = Extract<DescriptionToken, { type: 'time' }>;

const endOf = ({ start, text }: DescriptionToken) => start + text.length;

function links(text: string): LinkToken[] {
  return [...text.matchAll(LINK)].flatMap((match): LinkToken[] => {
    const href = match[0].replace(TRAILING_PUNCTUATION, '');
    if (!URL.canParse(href)) return [];

    return [{ type: 'link', text: href, start: match.index, href }];
  });
}

function times(text: string): TimeToken[] {
  return [...text.matchAll(TIMECODE)].flatMap((match): TimeToken[] => {
    const [time, hours, minutes = '', seconds = ''] = match;
    const total = secondsOf(hours, minutes, seconds);
    if (total === undefined) return [];

    return [{ type: 'time', text: time, start: match.index, seconds: total }];
  });
}

/** Splits a description into plain text, links and timecodes; a timecode inside a link stays in the link. */
export function tokenizeDescription(description: string): DescriptionToken[] {
  const linked = links(description);
  const inLink = ({ start }: TimeToken) =>
    linked.some((link) => start >= link.start && start < endOf(link));
  const found = [...linked, ...times(description).filter((time) => !inLink(time))].sort(
    (a, b) => a.start - b.start
  );

  const tokens: DescriptionToken[] = [];
  let at = 0;
  for (const token of found) {
    if (token.start > at) {
      tokens.push({ type: 'text', text: description.slice(at, token.start), start: at });
    }
    tokens.push(token);
    at = endOf(token);
  }
  if (at < description.length) {
    tokens.push({ type: 'text', text: description.slice(at), start: at });
  }

  return tokens;
}

/** The chapters a description lists: timecodes opening a line, two or more, the first at 00:00, rising. */
export function chaptersOf(description: string): Chapter[] {
  const chapters = description.split('\n').flatMap((line): Chapter[] => {
    const text = line.trim();
    const [first] = times(text);
    if (first?.start !== 0) return [];

    return [
      { seconds: first.seconds, title: text.slice(endOf(first)).replace(LEADING_SEPARATORS, '') },
    ];
  });

  const rising = chapters.every(
    ({ seconds }, index) => seconds > (chapters[index - 1]?.seconds ?? -1)
  );
  return chapters.length >= 2 && chapters[0]?.seconds === 0 && rising ? chapters : [];
}
