/** A token set's id as a viewer reads it: `xlarge` as `Xlarge`, so a set added to the registry needs no word of its own. */
export const setName = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);
