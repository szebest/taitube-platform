import { useToast } from '@kit/ui';
import { useApi } from '@vp/queries';
import { useT } from '#app/lib/messages';
import { downloadText } from '../utils/download-text';
import { useListMutation } from './use-list-mutation';

const MEDIA_TYPES = { json: 'application/json', csv: 'text/csv' } as const;

/** Fetches the playlist as a JSON or CSV document and hands it to the browser as a file. */
export function useExportPlaylist(playlistId: string) {
  const api = useApi();
  const showToast = useToast();
  const { tOr } = useT();

  return useListMutation({
    mutationFn: (format: 'json' | 'csv') =>
      api.playlistTransfer.exportPlaylist({ params: { id: playlistId }, query: { format } }),
    onSuccess: ({ format, filename, content }) => {
      downloadText(content, filename, MEDIA_TYPES[format]);
      showToast({ tone: 'success', title: tOr('playlistEdit.exported', { name: filename }, '') });
    },
  });
}
