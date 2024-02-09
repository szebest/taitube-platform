import { useUploadMutation } from '../../api/uploadApiSlice';

import { UploadFormModel } from '../../models';

import { VideoForm } from '../../components';

export function UploadPage() {
  const [upload, state] = useUploadMutation();

  const submit = (form: UploadFormModel) => {
    upload(form);
  }

  return (
    <VideoForm isEdit={false} submit={submit} {...state} />
  )
}

export default UploadPage;
