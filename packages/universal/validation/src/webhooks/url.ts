import { type Result, err, ok } from '@vp/result';
import { type InvalidField, invalidField } from '../failures';
import { isPrivateHost } from './host';

export const WEBHOOK_URL_MAX_LENGTH = 2048;

export interface WebhookUrlPolicy {
  /** A local receiver is a private host, and one without TLS; only a deployment that says so allows it. */
  readonly allowPrivateHosts: boolean;
}

type WebhookUrlProblem = 'malformed' | 'scheme' | 'credentials' | 'private-host';

export type InvalidWebhookUrl = InvalidField<{ reason: WebhookUrlProblem }>;

const MESSAGES: Record<WebhookUrlProblem, string> = {
  malformed: 'url must be an absolute URL of at most 2048 characters',
  scheme: 'url must use https',
  credentials: 'url must not carry a username or password',
  'private-host': 'url must point at a public host',
};

const reject = (reason: WebhookUrlProblem) =>
  err(invalidField('url', MESSAGES[reason], { reason }));

/**
 * The address an outbound call may be made to. Resolving the name is the sender's job, a literal
 * address or a private name is caught here.
 */
export function validateWebhookUrl(
  raw: string,
  policy: WebhookUrlPolicy
): Result<string, InvalidWebhookUrl> {
  const text = raw.trim();
  if (text === '' || text.length > WEBHOOK_URL_MAX_LENGTH || !URL.canParse(text)) {
    return reject('malformed');
  }

  const url = new URL(text);
  const plainHttpAllowed = policy.allowPrivateHosts && url.protocol === 'http:';
  if (url.protocol !== 'https:' && !plainHttpAllowed) return reject('scheme');
  if (url.username !== '' || url.password !== '') return reject('credentials');
  if (!policy.allowPrivateHosts && isPrivateHost(url.hostname)) return reject('private-host');

  return ok(url.href);
}
