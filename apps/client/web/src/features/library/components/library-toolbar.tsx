import { useNavigate } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { Button, Icon, Input, Switch } from '@vp/ui';
import { useId, useState } from 'react';

import { useAccountPreference } from '#app/features/settings/hooks/use-account-preference';
import { urlModals } from '#app/features/url-modal/registry';

type Scope = 'history' | 'searches';

/** Filters the history by title: the words live in `q`, and a keystroke replaces the entry rather than adding one. */
function HistoryFilter({ value = '' }: { value?: string }) {
  const { tOr } = useT();
  const navigate = useNavigate({ from: '/feed/history' });
  const [text, setText] = useState(value);

  return (
    <Input
      type="search"
      aria-label={tOr('library.filterLabel', {}, '')}
      placeholder={tOr('library.filterPlaceholder', {}, '')}
      value={text}
      onChange={({ target }) => {
        setText(target.value);
        void navigate({ search: (previous) => ({ ...previous, q: target.value }), replace: true });
      }}
    />
  );
}

/** The one `historyPaused` switch, which pauses watch history and search history together. */
function PauseHistorySwitch() {
  const { tOr } = useT();
  const hintId = useId();
  const [paused, setPaused] = useAccountPreference('privacy', 'historyPaused');

  return (
    <div className="tw:flex tw:items-center tw:gap-3">
      <Switch
        aria-label={tOr('settings.rowLabel', { row: 'pause-history' }, '')}
        aria-describedby={hintId}
        checked={paused}
        onCheckedChange={setPaused}
      />
      <div className="tw:flex tw:flex-col">
        <span>{tOr('settings.rowLabel', { row: 'pause-history' }, '')}</span>
        <span id={hintId} className="tw:text-body-sm tw:text-fg-muted">
          {tOr('settings.rowDescription', { row: 'pause-history' }, '')}
        </span>
      </div>
    </div>
  );
}

/** Opens the confirmation; nothing is cleared until the viewer says so there. */
function ClearHistoryButton({ scope }: { scope: Scope }) {
  const { tOr } = useT();
  const { open } = urlModals.useUrlModal('clear-history');

  return (
    <Button variant="outline" tone="danger" onClick={() => open({ scope })}>
      <Icon name="trash" />
      {tOr('library.clear', { scope }, '')}
    </Button>
  );
}

export interface LibraryToolbarProps {
  scope: Scope;
  /** The history filter's words; the searches tab has no filter. */
  filter?: string;
}

/** What manages a list of history: the filter, the one pause switch and Clear all. */
export function LibraryToolbar({ scope, filter }: LibraryToolbarProps) {
  return (
    <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-4">
      {scope === 'history' && <HistoryFilter value={filter} />}
      <PauseHistorySwitch />
      <ClearHistoryButton scope={scope} />
    </div>
  );
}
