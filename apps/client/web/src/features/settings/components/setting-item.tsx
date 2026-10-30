import { useLocation } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { type PropsWithChildren, type ReactNode, useEffect, useRef } from 'react';

import { SettingRow } from '#app/components/settings/setting-row';
import type { SettingRowId } from '../settings-index';
import { useNotSaved } from './preferences-sync.context';

export type SettingItemProps = PropsWithChildren<{
  /** The id the row has in the settings index, which is also its URL hash. */
  row: SettingRowId;
  /** Where the saved value lives (`playback.speed`), so the row says when saving it failed. */
  setting?: string;
  description?: ReactNode;
}>;

/**
 * One row of a settings page: its catalogue label, the control it is given, and the places a
 * search result sends the viewer to (the hash highlights it and scrolls it into view).
 */
export function SettingItem({ row, setting = '', description, children }: SettingItemProps) {
  const { tOr } = useT();
  const hash = useLocation({ select: ({ hash: current }) => current });
  const notSaved = useNotSaved(setting);
  const element = useRef<HTMLFieldSetElement>(null);
  const highlighted = hash === row;

  useEffect(() => {
    if (highlighted) element.current?.scrollIntoView({ block: 'center' });
  }, [highlighted]);

  return (
    <SettingRow.Root id={row} ref={element} highlighted={highlighted}>
      <SettingRow.Text>
        <SettingRow.Label>{tOr('settings.rowLabel', { row }, '')}</SettingRow.Label>
        {description && <SettingRow.Description>{description}</SettingRow.Description>}
      </SettingRow.Text>
      <SettingRow.Control>{children}</SettingRow.Control>
      {notSaved && <SettingRow.Status>{tOr('settings.notSaved', {}, '')}</SettingRow.Status>}
    </SettingRow.Root>
  );
}
