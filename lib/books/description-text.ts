import type { VerifiedBookDescription } from '@/app/data/books';

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  apos: "'",
  gt: '>',
  hellip: '…',
  ldquo: '“',
  lsquo: '‘',
  lt: '<',
  mdash: '—',
  nbsp: ' ',
  ndash: '–',
  quot: '"',
  rdquo: '”',
  rsquo: '’',
};

function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/gi,
    (entity, decimal: string | undefined, hexadecimal: string | undefined, name: string | undefined) => {
      const codePoint = decimal
        ? Number.parseInt(decimal, 10)
        : hexadecimal
          ? Number.parseInt(hexadecimal, 16)
          : null;
      if (codePoint !== null) {
        return Number.isSafeInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : '';
      }
      return name ? (NAMED_ENTITIES[name.toLowerCase()] ?? entity) : entity;
    },
  );
}

export function normalizeBookDescription(value: unknown): string | null {
  const raw =
    typeof value === 'string'
      ? value
      : value && typeof value === 'object' && 'value' in value
        ? (value as { value?: unknown }).value
        : null;
  if (typeof raw !== 'string' || !raw.trim()) return null;

  const withoutUnsafeBlocks = raw.replace(
    /<(script|style|noscript|template|iframe|object|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    '',
  );
  const withBreaks = withoutUnsafeBlocks
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|section|article|blockquote|h[1-6]|li)\s*>/gi, '\n\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  const decoded = decodeHtmlEntities(withBreaks)
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
  const paragraphs = decoded
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.replace(/[\t ]+/g, ' ').replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);

  return paragraphs.length > 0 ? paragraphs.join('\n\n') : null;
}

export function normalizeVerifiedBookDescription(
  value: unknown,
): VerifiedBookDescription | null {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Partial<VerifiedBookDescription>;
  const text = normalizeBookDescription(candidate.text);
  const source = candidate.source;
  const sourceKey =
    typeof candidate.sourceKey === 'string' ? candidate.sourceKey.trim() : '';
  const verifiedAt =
    typeof candidate.verifiedAt === 'string' ? candidate.verifiedAt.trim() : '';
  const language = candidate.language === 'en' || candidate.language === 'nl'
    ? candidate.language
    : null;

  if (
    !text ||
    (source !== 'open_library' && source !== 'google_books') ||
    !sourceKey ||
    !verifiedAt
  ) {
    return null;
  }

  return { text, source, sourceKey, verifiedAt, language };
}

export function splitBookDescriptionParagraphs(
  description: string,
  targetLength = 320,
): string[] {
  const sourceParagraphs = description.split(/\n\s*\n+/).filter(Boolean);
  return sourceParagraphs.flatMap((paragraph) => {
    if (paragraph.length <= targetLength) return [paragraph];
    const sentences = paragraph.match(/[^.!?…]+(?:[.!?…]+[”’'\"]*|$)/g) ?? [paragraph];
    const units = sentences.flatMap((sentence) => {
      const cleanSentence = sentence.trim();
      if (cleanSentence.length <= targetLength) return [cleanSentence];
      const wordChunks: string[] = [];
      let wordChunk = '';
      for (const word of cleanSentence.split(/\s+/)) {
        if (wordChunk && wordChunk.length + word.length + 1 > targetLength) {
          wordChunks.push(wordChunk);
          wordChunk = word;
        } else {
          wordChunk = wordChunk ? `${wordChunk} ${word}` : word;
        }
      }
      if (wordChunk) wordChunks.push(wordChunk);
      return wordChunks;
    });
    const chunks: string[] = [];
    let chunk = '';
    for (const unit of units) {
      if (!unit) continue;
      if (chunk && chunk.length + unit.length + 1 > targetLength) {
        chunks.push(chunk);
        chunk = unit;
      } else {
        chunk = chunk ? `${chunk} ${unit}` : unit;
      }
    }
    if (chunk) chunks.push(chunk);
    return chunks.length > 0 ? chunks : [paragraph];
  });
}
