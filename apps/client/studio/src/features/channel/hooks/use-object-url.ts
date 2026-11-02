import { useEffect, useState } from 'react';

/** A local address for the chosen file, revoked when the file changes or the page goes. */
export function useObjectUrl(file: File | undefined): string | undefined {
  const [created, setCreated] = useState<{ file: File; url: string }>();

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCreated({ file, url });
    const revoke = () => URL.revokeObjectURL(url);
    return revoke;
  }, [file]);

  return file && created?.file === file ? created.url : undefined;
}
