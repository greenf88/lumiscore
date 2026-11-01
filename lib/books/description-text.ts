import type { VerifiedBookDescription } from '@/app/data/books';
import { reviewedDescriptionSource } from './reviewed-descriptions.ts';
import { safePublicSource } from './stored-presentation.ts';

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

  const text=paragraphs.join('\n\n');
  // Some exact edition feeds put pagination and reading levels in the
  // description field. Reject only a complete bibliographic stub: genuine
  // prose may mention pages, an edition or a reading level and must survive.
  if (/^(?:[ivxlcdm]+[,.]?\s*)?(?:\d+\s*(?:pages?|p\.|pagina['’]?s?|blz\.)|1\s+v\.\s*\(unpaged\))\s*(?::\s*(?:(?:col\.|color|colour)\s*)?ill(?:ustrations)?\.?\s*(?:,\s*map)?\s*)?(?:;\s*\d+(?:\s*x\s*\d+)?\s*cm\.?)?\s*(?:(?:[A-Z]{0,2}\d+L?)\s*Lexile[.;]?\s*)*(?:;?\s*Ages?\s+\d+\s+and\s+up\.?)?[.\s]*$/iu.test(text)) return null;
  if (paragraphs.length>1&&paragraphs.every(p=>/^(?:(?:first|second|third|fourth|fifth)\s+(?:United States\s+)?(?:edition|printing)|includes bibliographical references and index|published\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}|reprinted\s+(?:\d+|one|two|three|four|five)\s+times|(?:first|second|third|fourth|fifth)\s+printing,\s+[A-Za-z]+\s+\d{4})\.?$/iu.test(p))) return null;
  // A containment link is bibliography, not a synopsis. Keep genuine prose
  // that happens to mention an anthology; reject only the complete link stub.
  if (/^(?:(?:also\s+)?(?:contained|included|collected)\s+in|(?:ook\s+)?opgenomen\s+in)\s*:\s*(?:(?:[-*]\s*)?\[[^\]\r\n]+\]\(https?:\/\/[^)\s]+\)\s*)+$/iu.test(text)) return null;
  // Transport/error documents and empty boilerplate are not book summaries.
  if(!text||/^(?:(?:error\s*)?(?:403|404|429|500|502|503|504)\b|access denied\b|too many requests\b|service unavailable\b|internal server error\b|captcha\b|just a moment\b)/i.test(text)
    ||/^(?:no (?:book )?description(?: available| found)?|description (?:not available|unavailable|missing)|geen (?:boek)?beschrijving(?: beschikbaar| gevonden)?|samenvatting (?:ontbreekt|niet beschikbaar)|n\/?a|not available|unknown)[.!\s]*$/i.test(text)
    ||/^(?:\d+(?:e|ste|de|st|nd|rd|th)?\s*(?:dr(?:uk)?|ed(?:ition)?)\.?\s*:?\s*\d{4}[.!\s]*|(?:first|originally) published(?: in)?\s+\d{4}[.!\s]*)$/i.test(text))return null;
  return text;
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
    (source !== 'open_library' && source !== 'google_books' &&
      !((source === 'official_publisher' || source === 'official_catalog') && (reviewedDescriptionSource(sourceKey, source) ||
        safePublicSource(candidate.sourceUrl)&&candidate.sourceUrl===sourceKey&&typeof candidate.sourceName==='string'&&candidate.sourceName.length<=120))) ||
    !sourceKey ||
    !verifiedAt
  ) {
    return null;
  }

  return { text, source, sourceKey, verifiedAt, language,
    ...(safePublicSource(candidate.sourceUrl)?{sourceUrl:candidate.sourceUrl,sourceName:candidate.sourceName}:{}) };
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
