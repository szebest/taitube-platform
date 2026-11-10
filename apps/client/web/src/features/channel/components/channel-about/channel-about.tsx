import type { Channel } from '@vp/api-contracts';
import { Format, useT } from '@vp/intl-react';
import { PlatformIcon } from '@vp/ui';
import { useId } from 'react';
import { httpsUrl } from '#app/features/channel/utils/https-url';
import { ContactReveal } from '../contact-reveal/contact-reveal';

export interface ChannelAboutProps {
  channel: Pick<Channel, 'id' | 'links' | 'country' | 'hasContact'>;
}

/** The creator's links with their platform marks, the country as a region name and the contact email behind a button; nothing when the channel lists none. */
export function ChannelAbout({ channel: { id, links, country, hasContact } }: ChannelAboutProps) {
  const { tOr } = useT();
  const titleId = useId();
  const safeLinks = links.flatMap(({ label, url, platform }) => {
    const href = httpsUrl(url);
    return href === undefined ? [] : [{ label, href, platform }];
  });

  if (safeLinks.length === 0 && country === null && !hasContact) {
    return null;
  }

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-stack">
      <h2 id={titleId} className="m-0 text-title-lg">
        {tOr('channels.aboutTitle', {}, '')}
      </h2>
      <dl className="m-0 flex flex-col gap-stack text-body">
        {safeLinks.length > 0 && (
          <div className="flex flex-col gap-inline">
            <dt className="text-label text-fg-muted">{tOr('channels.aboutLinks', {}, '')}</dt>
            <dd className="m-0">
              <ul className="m-0 flex list-none flex-wrap gap-x-stack gap-y-inline p-0">
                {safeLinks.map(({ label, href, platform }) => (
                  <li key={href}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-touch-target items-center gap-inline text-accent-ink focus-ring"
                    >
                      <PlatformIcon platform={platform} size="sm" />
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {country !== null && (
          <div className="flex flex-col gap-inline">
            <dt className="text-label text-fg-muted">{tOr('channels.aboutCountry', {}, '')}</dt>
            <dd className="m-0">
              <Format
                value={{ type: 'displayName', value: country, of: 'region' }}
                fallback={country}
              />
            </dd>
          </div>
        )}
        {hasContact && (
          <div className="flex flex-col gap-inline">
            <dt className="text-label text-fg-muted">{tOr('channels.aboutContact', {}, '')}</dt>
            <dd className="m-0">
              <ContactReveal channelId={id} />
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
