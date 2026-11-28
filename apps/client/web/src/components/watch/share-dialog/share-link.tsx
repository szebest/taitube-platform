import { fromPromise, unwrapOr } from '@kit/result';
import { Button, useUiCopy } from '@kit/ui';
import { useId } from 'react';
import { useCopyLink } from '#app/hooks/use-copy-link';
import { useT } from '#app/lib/messages';
import { splitLink } from './utils/split-link';

const LINK_TAIL_LENGTH = 14;

function ShareLink({ link, labelledBy }: { link: string; labelledBy: string }) {
  const { head, tail } = splitLink(link, LINK_TAIL_LENGTH);

  return (
    <div
      aria-labelledby={labelledBy}
      aria-readonly="true"
      className="flex h-control-md min-w-0 flex-1 items-center rounded-control border-control border-border-strong bg-surface px-inset-control font-sans text-body text-fg select-text focus-ring"
      role="textbox"
      tabIndex={0}
      onFocus={(event) => window.getSelection()?.selectAllChildren(event.currentTarget)}
    >
      <span className="min-w-0 truncate">{head}</span>
      <span className="shrink-0">{tail}</span>
    </div>
  );
}

export interface ShareLinkFieldProps {
  link: string;
  label: string;
  /** What the Copy button says; the kit's Copy when absent. */
  copyLabel?: string;
  /** Focuses Copy as it appears, for a dialog whose first act is copying. */
  autoFocusCopy?: boolean;
}

/** A link in a read-only field that selects itself, with the Copy button beside it. */
export function ShareLinkField({ link, label, copyLabel, autoFocusCopy }: ShareLinkFieldProps) {
  const copyLink = useCopyLink();
  const { copy } = useUiCopy();
  const labelId = useId();

  return (
    <div className="flex min-w-0 flex-col gap-inline">
      <span id={labelId} className="text-label">
        {label}
      </span>
      <div className="flex min-w-0 items-center gap-inline">
        <ShareLink link={link} labelledBy={labelId} />
        <Button className="shrink-0" autoFocus={autoFocusCopy} onClick={() => copyLink(link)}>
          {copyLabel ?? copy}
        </Button>
      </div>
    </div>
  );
}

export function canShareNatively(): boolean {
  return typeof navigator.share === 'function';
}

/** Opens the device's own share sheet; offer it only where `canShareNatively`. */
export function ShareNativeButton({ title, link }: { title: string; link: string }) {
  const { tOr } = useT();

  const shareNatively = async () => {
    unwrapOr(
      await fromPromise(
        () => navigator.share({ title, url: link }),
        (cause) => cause
      ),
      undefined
    );
  };

  return (
    <Button variant="outline" size="sm" onClick={shareNatively}>
      {tOr('share.native', {}, '')}
    </Button>
  );
}
