import { useQuery } from '@tanstack/react-query';
import { SectionError } from '@vp/components';
import { useT } from '@vp/intl-react';
import { useCan } from '@vp/permissions-react';
import { useApi } from '@vp/queries';
import { Button, Checkbox, Icon, Label, Skeleton } from '@vp/ui';
import { useState } from 'react';

import { useSignIn } from '#app/features/auth/hooks/use-sign-in';
import { urlModals } from '#app/features/url-modal/registry';

import { saveTargetsQueryOptions } from '../api/library-queries';
import { useTogglePlaylistItem } from '../hooks/use-toggle-playlist-item';
import { NewPlaylistForm } from './new-playlist-form';

const { UrlModal, useUrlModal } = urlModals;

function SaveTargets({ videoId }: { videoId: string }) {
  const api = useApi();
  const { tOr } = useT();
  const { data, isPending, isError, isFetching, refetch } = useQuery(
    saveTargetsQueryOptions(api, videoId)
  );
  const toggle = useTogglePlaylistItem(videoId);
  const [creating, setCreating] = useState(false);

  if (isError) {
    return (
      <SectionError.Root role="alert" retrying={isFetching} onRetry={() => void refetch()}>
        <SectionError.Message>{tOr('library.saveLoadFailed', {}, '')}</SectionError.Message>
      </SectionError.Root>
    );
  }
  if (isPending) return <Skeleton aria-hidden="true" className="tw:h-24 tw:w-full" />;

  return (
    <div className="tw:flex tw:flex-col tw:gap-stack">
      <ul className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-2 tw:p-0">
        {data.items.map(({ id, title, containsVideo, isSystem }) => (
          <li key={id}>
            <Label className="tw:flex tw:items-center tw:gap-inline">
              <Checkbox
                checked={containsVideo}
                onCheckedChange={(next) =>
                  toggle.mutate({ playlistId: id, title, saved: next === true })
                }
              />
              {isSystem && <Icon name="clock" size="sm" />}
              {title}
            </Label>
          </li>
        ))}
      </ul>
      {creating ? (
        <NewPlaylistForm
          videoId={videoId}
          onCreated={() => setCreating(false)}
          onCancel={() => setCreating(false)}
        />
      ) : (
        <Button variant="ghost" onClick={() => setCreating(true)}>
          <Icon name="plus" />
          {tOr('library.newPlaylist', {}, '')}
        </Button>
      )}
    </div>
  );
}

function SignInPrompt() {
  const { tOr } = useT();
  const signIn = useSignIn();

  return (
    <div className="tw:flex tw:flex-col tw:items-start tw:gap-stack">
      <p>{tOr('library.saveSignIn', {}, '')}</p>
      <Button variant="solid" tone="accent" onClick={signIn}>
        {tOr('auth.signIn', {}, '')}
      </Button>
    </div>
  );
}

/** `?modal=save-to-playlist&videoId=`: the viewer's playlists with a checkbox each, Watch Later first. */
export function SaveToPlaylistDialog() {
  const { tOr } = useT();
  const { params } = useUrlModal('save-to-playlist');
  const canSave = useCan('create', 'Playlist');

  return (
    <UrlModal.Root id="save-to-playlist">
      <UrlModal.Content>
        <UrlModal.Title>{tOr('library.saveTitle', {}, '')}</UrlModal.Title>
        <UrlModal.Description>{tOr('library.saveBody', {}, '')}</UrlModal.Description>
        <UrlModal.Body>
          {params && (canSave ? <SaveTargets videoId={params.videoId} /> : <SignInPrompt />)}
        </UrlModal.Body>
      </UrlModal.Content>
    </UrlModal.Root>
  );
}
