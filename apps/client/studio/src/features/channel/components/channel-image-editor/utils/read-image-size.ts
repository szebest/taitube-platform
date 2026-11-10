import { fromPromise, isOk } from '@vp/result';

/** The pixels the browser decodes from the file, or undefined when it cannot be decoded as an image. */
export async function readImageSize(
  file: Blob
): Promise<{ width: number; height: number } | undefined> {
  const decoded = await fromPromise(
    () => createImageBitmap(file),
    (cause) => cause
  );
  if (!isOk(decoded)) return undefined;

  const { width, height } = decoded.value;
  decoded.value.close();
  return { width, height };
}
