import type { VideoVisibility } from '@vp/domain';
import { createCompoundContext } from '@vp/ui';
import { type PropsWithChildren, useState } from 'react';

import { useUploadVideo } from './use-upload-video';

export type UploadItem =
  | { kind: 'sending'; id: string; title: string }
  | { kind: 'sent'; id: string; title: string; videoId: string }
  | { kind: 'failed'; id: string; title: string };

export interface UploadStart {
  file: File;
  title: string;
  visibility: VideoVisibility;
}

interface UploadDockValue {
  items: readonly UploadItem[];
  sending: boolean;
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  start: (upload: UploadStart) => void;
  cancel: (id: string) => void;
  dismiss: (id: string) => void;
}

const [UploadDockContext, useUploadDock] = createCompoundContext<UploadDockValue>('UploadDock');

export { useUploadDock };

/**
 * The uploads of this studio session and the dialog that starts them. It sits in the layout
 * route, so a transfer and its processing rows outlive every page the creator moves between.
 */
export function UploadDockProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<readonly UploadItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const upload = useUploadVideo();

  const settle = (next: UploadItem) =>
    setItems((current) => current.map((item) => (item.id === next.id ? next : item)));

  const remove = (id: string) =>
    setItems((current) => current.filter((item) => item.id !== id));

  const start = ({ file, title, visibility }: UploadStart) => {
    const id = crypto.randomUUID();
    setItems((current) => [...current, { kind: 'sending', id, title }]);

    upload.start(
      id,
      { file, filename: file.name, sizeBytes: file.size, contentType: file.type, title, visibility },
      {
        onSuccess: ({ videoId }) => settle({ kind: 'sent', id, title, videoId }),
        onError: () => settle({ kind: 'failed', id, title }),
      }
    );
  };

  const cancel = (id: string) => {
    upload.cancel();
    remove(id);
  };

  return (
    <UploadDockContext
      value={{
        items,
        sending: items.some((item) => item.kind === 'sending'),
        dialogOpen,
        setDialogOpen,
        start,
        cancel,
        dismiss: remove,
      }}
    >
      {children}
    </UploadDockContext>
  );
}
