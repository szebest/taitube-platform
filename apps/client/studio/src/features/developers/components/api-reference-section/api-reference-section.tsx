import { useT } from '@vp/intl-react';
import { Button, Icon, useUiCopy } from '@vp/ui';
import { curlExamples } from '#app/features/developers/api/curl-examples';
import { useCopyField } from '#app/hooks/use-copy-field';
import { API_PUBLIC_URL } from '#app/lib/config';
import { DeveloperSection } from '../developer-section/developer-section';

const EXAMPLES = curlExamples(API_PUBLIC_URL);

const LINKS = [
  { key: 'studio.referenceDocument', href: `${API_PUBLIC_URL}/openapi.json` },
  { key: 'studio.referenceBrowse', href: `${API_PUBLIC_URL}/docs` },
] as const;

/** Where the whole API is described, and one command per scope to try a token with. */
export function ApiReferenceSection() {
  const { tOr } = useT();
  const words = useUiCopy();
  const copy = useCopyField();

  return (
    <DeveloperSection
      title={tOr('studio.referenceTitle', {}, '')}
      description={tOr('studio.referenceDescription', {}, '')}
    >
      <div className="flex flex-wrap gap-inline">
        {LINKS.map(({ key, href }) => (
          <Button key={key} asChild variant="outline" size="sm">
            <a href={href} target="_blank" rel="noreferrer">
              {tOr(key, {}, '')}
              <Icon name="chevron-right" className="rtl:-scale-x-100" />
            </a>
          </Button>
        ))}
      </div>
      <h3 className="m-0 text-title-sm">{tOr('studio.referenceExamples', {}, '')}</h3>
      <ul className="m-0 flex list-none flex-col gap-stack p-0">
        {EXAMPLES.map(({ scope, endpoint, command }) => {
          const label = tOr('studio.referenceExampleLabel', { scope }, '');
          return (
            <li key={scope} className="flex min-w-0 flex-col gap-1">
              <span className="flex flex-wrap items-center justify-between gap-inline">
                <span className="flex min-w-0 flex-wrap items-baseline gap-inline">
                  <code className="font-mono text-label">{scope}</code>
                  <code className="font-mono text-caption text-fg-muted">
                    {endpoint.method} {endpoint.path}
                  </code>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={tOr('studio.referenceCopyExample', { scope }, '')}
                  onClick={() => copy(label, command)}
                >
                  {words.copy}
                </Button>
              </span>
              <pre className="m-0 whitespace-pre-wrap break-all rounded-control bg-tint p-inline font-mono text-caption select-text">
                {command}
              </pre>
            </li>
          );
        })}
      </ul>
    </DeveloperSection>
  );
}
