export type TextPart =
  | { kind: 'text'; text: string; start: number }
  | { kind: 'link'; text: string; href: string; start: number };

const OPENING = '([{"\'';
const CLOSING = '.,;:!?)]}"\'';
const SCHEME = 'https://';

function httpsHref(candidate: string): string | null {
  if (!candidate.startsWith(SCHEME) || !URL.canParse(candidate)) {
    return null;
  }
  const { protocol, hostname, href } = new URL(candidate);

  return protocol === 'https:' && hostname !== '' ? href : null;
}

function trimmed(word: string) {
  let start = 0;
  while (start < word.length && OPENING.includes(word.charAt(start))) {
    start += 1;
  }
  let end = word.length;
  while (end > start && CLOSING.includes(word.charAt(end - 1))) {
    end -= 1;
  }

  return {
    before: word.slice(0, start),
    candidate: word.slice(start, end),
    after: word.slice(end),
  };
}

function endOf(parts: readonly TextPart[]) {
  const last = parts.at(-1);

  return last ? last.start + last.text.length : 0;
}

function appendText(parts: TextPart[], text: string) {
  const last = parts.at(-1);
  if (text === '') {
    return;
  }
  if (last?.kind === 'text') {
    last.text += text;
  } else {
    parts.push({ kind: 'text', text, start: endOf(parts) });
  }
}

/** Splits plain text into text and `https` links; nothing else in it is markup, and a link keeps the punctuation that ends its sentence outside it. */
export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = [];

  for (const word of text.split(/(\s+)/)) {
    const { before, candidate, after } = trimmed(word);
    const href = httpsHref(candidate);
    if (href === null) {
      appendText(parts, word);
      continue;
    }
    appendText(parts, before);
    parts.push({ kind: 'link', text: candidate, href, start: endOf(parts) });
    appendText(parts, after);
  }

  return parts;
}
