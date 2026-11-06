import { useT } from '@vp/intl-react';
import Markdown from 'react-markdown';

export function DescriptionPreview({ markdown }: { markdown: string }) {
  const { tOr } = useT();

  return (
    <section
      aria-label={tOr('studio.editPreview', {}, '')}
      className="flex flex-col gap-inline rounded-sm border border-border p-inset-control text-body-sm"
    >
      {markdown.trim() === '' ? (
        <p className="text-fg-muted">{tOr('studio.editPreviewEmpty', {}, '')}</p>
      ) : (
        <Markdown
          disallowedElements={['img']}
          components={{
            a: ({ node: _node, ...link }) => (
              <a {...link} target="_blank" rel="noopener noreferrer" />
            ),
          }}
        >
          {markdown}
        </Markdown>
      )}
    </section>
  );
}
