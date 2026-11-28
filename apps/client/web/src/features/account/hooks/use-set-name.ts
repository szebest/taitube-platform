import { useFormat } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';

/** A token set's id as a viewer reads it: `xlarge` as `Xlarge`, so a set added to the registry needs no word of its own. */
export function useSetName(): (id: string) => string {
  const { format } = useFormat();
  return (id) => unwrapOr(format({ type: 'capitalize', value: id }), id);
}
