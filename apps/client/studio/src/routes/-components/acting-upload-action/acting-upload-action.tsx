import { canUpdateVideo } from '@vp/permissions';
import { Can } from '@vp/permissions-react';
import { useAccount } from '@vp/queries';
import { UploadToolbarButton } from '#app/features/upload';
import { useActiveChannel } from '#app/hooks/use-active-channel';

function SignedInUploadAction() {
  const { ownerId } = useActiveChannel();

  return (
    <Can type="rule" I={canUpdateVideo} this={{ video: { ownerId } }}>
      <UploadToolbarButton />
    </Can>
  );
}

/** The toolbar's upload button, for a signed-in viewer whose role on the acting channel may upload. */
export function ActingUploadAction() {
  return useAccount() ? <SignedInUploadAction /> : null;
}
