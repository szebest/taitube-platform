type InlineStyleProps = Readonly<{ css: string; nonce: string | undefined }>;

/** Generated CSS as a `<style>` under the request nonce, which a strict `style-src` still allows. */
export function InlineStyle({ css, nonce }: InlineStyleProps) {
  return (
    <style
      nonce={nonce}
      suppressHydrationWarning
      // biome-ignore lint/security/noDangerouslySetInnerHtml: generated CSS of schema-checked ids and colours, which React would escape into broken selectors.
      dangerouslySetInnerHTML={{ __html: css }}
    />
  );
}
