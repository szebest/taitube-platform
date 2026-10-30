import { Fragment } from 'react';

import { splitOnTerms } from '../matched-terms';

export interface MatchedTextProps {
  text: string;
  terms: readonly string[];
}

/** `text` with every match of a query term in a `<mark>`, bold as well as tinted. */
export function MatchedText({ text, terms }: MatchedTextProps) {
  return splitOnTerms(text, terms).map((part) =>
    part.matched ? (
      <mark
        key={part.start}
        className="tw:rounded-xs tw:bg-accent-soft tw:font-bold tw:text-inherit"
      >
        {part.text}
      </mark>
    ) : (
      <Fragment key={part.start}>{part.text}</Fragment>
    )
  );
}
