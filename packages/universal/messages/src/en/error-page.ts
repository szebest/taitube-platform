import { dt } from '../define';

/** The headings and actions of a page that failed; the sentence under each heading is `errors`. */
export const errorPage = {
  notFoundTitle: dt('Page not found'),
  forbiddenTitle: dt('You do not have access to this'),
  unauthorisedTitle: dt('Sign in to continue'),
  rateLimitedTitle: dt('Slow down for a moment'),
  serverTitle: dt('Something went wrong on our side'),
  genericTitle: dt('There was an error while loading the page'),
  home: dt('Go to the home page'),
} as const;
