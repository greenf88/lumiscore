/** Inspect the HTTP response, including hoisted tags, without executing client JS. */
export function inspectServerHtml(html: string) {
  const markup = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  const tags = [...markup.matchAll(/<(meta|link|html)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)];
  const metadata: Record<string, string[]> = {};
  let lang = '';
  for (const [tag, tagName] of tags) {
    const attributes = Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
      .map(([, name, double, single, bare]) => [name.toLowerCase(), (double ?? single ?? bare).replaceAll('&amp;', '&').replaceAll('&#x27;', "'").replaceAll('&quot;', '"')]));
    if (tagName.toLowerCase() === 'html') lang = attributes.lang ?? '';
    const key = tagName.toLowerCase() === 'meta' ? attributes.name ?? attributes.property
      : attributes.rel === 'canonical' ? 'canonical' : undefined;
    if (key) (metadata[key] ??= []).push(attributes.content ?? attributes.href ?? '');
  }
  return {
    lang, robots: metadata.robots ?? [], canonical: metadata.canonical ?? [], metadata,
    duplicates: Object.keys(metadata).filter((key) => metadata[key].length > 1),
    h1: [...markup.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(([, text]) => text.replace(/<[^>]*>/g, '').trim()),
  };
}
