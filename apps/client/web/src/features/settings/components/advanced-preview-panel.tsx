import { useT } from '@vp/intl-react';

const THUMBNAILS = ['one', 'two', 'three'];

/** A small home shelf and watch header, drawn with the tokens now in force, so a change is seen whole. */
export function AdvancedPreviewPanel() {
  const { tOr } = useT();

  return (
    <aside
      data-slot="advanced-preview"
      aria-label={tOr('settings.previewTitle', {}, '')}
      className="flex flex-col gap-section rounded-card border-divider border-border bg-surface p-inset-card text-fg shadow-1 expanded:sticky expanded:top-header"
    >
      <h2 className="m-0 text-label text-fg-muted">
        {tOr('settings.previewTitle', {}, '')}
      </h2>
      <section className="flex flex-col gap-stack">
        <h3 className="m-0 text-title">{tOr('settings.previewShelf', {}, '')}</h3>
        <ul className="m-0 grid list-none grid-cols-3 gap-grid-x p-0">
          {THUMBNAILS.map((thumbnail) => (
            <li key={thumbnail} className="flex min-w-0 flex-col gap-1">
              <span className="block aspect-video rounded-thumb bg-tint-strong" />
              <span className="truncate text-caption">
                {tOr('settings.previewVideo', {}, '')}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-stack">
        <h3 className="m-0 text-title">{tOr('settings.previewVideo', {}, '')}</h3>
        <div className="flex items-center gap-inline">
          <span className="size-avatar-md shrink-0 rounded-full bg-tint-strong" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-label">
              {tOr('settings.previewChannel', {}, '')}
            </span>
            <span className="truncate text-caption text-fg-muted">
              {tOr('settings.previewMeta', {}, '')}
            </span>
          </div>
          <span className="inline-flex h-control-md items-center rounded-control bg-accent px-inset-control text-label text-on-accent">
            {tOr('settings.previewSubscribe', {}, '')}
          </span>
        </div>
      </section>
    </aside>
  );
}
