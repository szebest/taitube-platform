import { useT } from '@vp/intl-react';
import Markdown from 'react-markdown';

export function DescriptionPreview({ markdown }: { markdown: string }) {
  const { tOr } = useT();

  return (
    <section
      aria-label={tOr('studio.editPreview', {}, '')}
      className="tw:flex tw:flex-col tw:gap-inline tw:rounded-sm tw:border tw:border-border tw:p-inset-control tw:text-body-sm"
    >
      {markdown.trim() === '' ? (
        <p className="tw:text-fg-muted">{tOr('studio.editPreviewEmpty', {}, '')}</p>
      ) : (
        <Markdown
          disallowedElements={['img']}
          components={{
            a: ({ node: _node, ...link }) => <a {...link} target="_blank" rel="noopener noreferrer" />,
          }}
        >
          {markdown}
        </Markdown>
      )}
    </section>
  );
}
