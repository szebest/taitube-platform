import { useT } from '@vp/intl-react';

const THUMBNAILS = ['one', 'two', 'three'];

/** A small home shelf and watch header, drawn with the tokens now in force, so a change is seen whole. */
export function AdvancedPreviewPanel() {
  const { tOr } = useT();

  return (
    <aside
      data-slot="advanced-preview"
      aria-label={tOr('settings.previewTitle', {}, '')}
      className="tw:flex tw:flex-col tw:gap-section tw:rounded-card tw:border-divider tw:border-border tw:bg-surface tw:p-inset-card tw:text-fg tw:shadow-1 tw:expanded:sticky tw:expanded:top-header"
    >
      <h2 className="tw:m-0 tw:text-label tw:text-fg-muted">
        {tOr('settings.previewTitle', {}, '')}
      </h2>
      <section className="tw:flex tw:flex-col tw:gap-stack">
        <h3 className="tw:m-0 tw:text-title">{tOr('settings.previewShelf', {}, '')}</h3>
        <ul className="tw:m-0 tw:grid tw:list-none tw:grid-cols-3 tw:gap-grid-x tw:p-0">
          {THUMBNAILS.map((thumbnail) => (
            <li key={thumbnail} className="tw:flex tw:min-w-0 tw:flex-col tw:gap-1">
              <span className="tw:block tw:aspect-video tw:rounded-thumb tw:bg-tint-strong" />
              <span className="tw:truncate tw:text-caption">
                {tOr('settings.previewVideo', {}, '')}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="tw:flex tw:flex-col tw:gap-stack">
        <h3 className="tw:m-0 tw:text-title">{tOr('settings.previewVideo', {}, '')}</h3>
        <div className="tw:flex tw:items-center tw:gap-inline">
          <span className="tw:size-avatar-md tw:shrink-0 tw:rounded-full tw:bg-tint-strong" />
          <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
            <span className="tw:truncate tw:text-label">
              {tOr('settings.previewChannel', {}, '')}
            </span>
            <span className="tw:truncate tw:text-caption tw:text-fg-muted">
              {tOr('settings.previewMeta', {}, '')}
            </span>
          </div>
          <span className="tw:inline-flex tw:h-control-md tw:items-center tw:rounded-control tw:bg-accent tw:px-inset-control tw:text-label tw:text-on-accent">
            {tOr('settings.previewSubscribe', {}, '')}
          </span>
        </div>
      </section>
    </aside>
  );
}
