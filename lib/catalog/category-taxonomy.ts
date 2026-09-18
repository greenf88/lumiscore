export const CATALOG_CATEGORY_MAPPING_VERSION = 'catalog_categories_v1';

export const CATALOG_CATEGORIES = [
  'Fantasy',
  'Science Fiction',
  'Thriller & Mystery',
  'Romance',
  'Contemporary Fiction',
  'Literary Fiction',
  'Historical Fiction',
  'Horror',
  'Classics',
  'Non-fiction',
  'Biography & Memoir',
  'Psychology & Self-development',
  'Business & Economics',
  'History',
  'Science & Nature',
  'Young Adult',
  'Children',
] as const;

export type CatalogCategory = (typeof CATALOG_CATEGORIES)[number];

export type CatalogCategoryInput = {
  sourceLabels?: readonly string[];
  legacyCategories?: readonly string[];
  firstPublishYear?: number | null;
};

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function matchesAny(labels: readonly string[], patterns: readonly RegExp[]): boolean {
  return labels.some((label) => patterns.some((pattern) => pattern.test(label)));
}

export function mapCatalogCategories(input: CatalogCategoryInput): CatalogCategory[] {
  const legacy = new Set((input.legacyCategories ?? []).map(normalize));
  const labels = [
    ...(input.sourceLabels ?? []).map(normalize),
    ...[...legacy].filter((label) => label !== 'fantasy science fiction'),
  ].filter(Boolean);
  const result = new Set<CatalogCategory>();
  const hasFictionSignal = matchesAny(labels, [
    /\bfiction\b/, /\bnovels?\b/, /\bstories\b/, /\bdrama\b/, /\bplays?\b/,
  ]);
  const add = (category: CatalogCategory, patterns: readonly RegExp[]) => {
    if (matchesAny(labels, patterns)) result.add(category);
  };

  add('Fantasy', [
    /\bfantasy\b/, /\bepic fantasy\b/, /\burban fantasy\b/, /\bdark fantasy\b/,
    /\bmagic\b/, /\bmagical realism\b/, /\bfairy tales?\b/, /\bdragons?\b/,
  ]);
  add('Science Fiction', [
    /\bscience fiction\b/, /\bspace opera\b/, /\bcyberpunk\b/, /\bdystopi(?:a|an|as)\b/,
    /\btime travel\b/, /\balien(?:s)?\b/, /\bspeculative fiction\b/,
  ]);
  add('Thriller & Mystery', [
    /\bthrillers?\b/, /\bmysteries?\b/, /\bmystery fiction\b/, /\bcrime fiction\b/,
    /\bdetective(?:s| fiction)?\b/, /\bsuspense(?: fiction)?\b/, /\bpolice procedural\b/,
  ]);
  add('Romance', [
    /\bromance\b/, /\bromantic fiction\b/, /\blove stories\b/, /\bromance feelgood\b/,
  ]);
  add('Contemporary Fiction', [
    /\bcontemporary fiction\b/, /\bcontemporary general fiction\b/,
    /\bdomestic fiction\b/, /\bfamily life fiction\b/,
  ]);
  add('Literary Fiction', [
    /\bliterary fiction\b/, /\bfiction literary\b/, /\bliterary general fiction\b/,
  ]);
  add('Historical Fiction', [
    /\bhistorical fiction\b/, /\bhistorical novels?\b/, /\bwar fiction\b/,
    /\bfiction history\b/,
  ]);
  add('Horror', [
    /\bhorror\b/, /\bhorror fiction\b/, /\bghost stories\b/, /\bgothic fiction\b/,
  ]);
  add('Classics', [/\bclassics?\b/, /\bclassic literature\b/]);
  add('Non-fiction', [
    /\bnon ?fiction\b/, /\bessays?\b/, /\breference\b/, /\bjournalism\b/,
    /\btravel writing\b/, /\bphilosophy\b/, /\bpolitical science\b/,
  ]);
  add('Biography & Memoir', [
    /\bbiograph(?:y|ies|ical)\b/, /\bautobiograph(?:y|ies|ical)\b/, /\bmemoirs?\b/,
    /\bpersonal narratives?\b/,
  ]);
  const selfDevelopment = [
    /\bpsychology\b/, /\bself help\b/, /\bself improvement\b/, /\bpersonal growth\b/,
    /\bself development\b/, /\bhabits?\b/, /\bmotivation(?:al)?\b/,
  ];
  if (!hasFictionSignal || matchesAny(labels, [/\bself help\b/, /\bself improvement\b/, /\bself development\b/])) {
    add('Psychology & Self-development', selfDevelopment);
  }
  if (!hasFictionSignal) add('Business & Economics', [
    /\bbusiness\b/, /\beconomics?\b/, /\bfinance\b/, /\bmanagement\b/,
    /\bentrepreneurship\b/, /\bleadership\b/, /\bmarketing\b/,
  ]);
  if (!hasFictionSignal) add('History', [
    /\bhistory\b/, /\bworld history\b/, /\bhistorical non ?fiction\b/,
    /\bcivilization\b/, /\bsocial history\b/,
  ]);
  if (!hasFictionSignal) add('Science & Nature', [
    /^(?:popular )?science$/, /\bnature\b/, /\bbiology\b/, /\bphysics\b/, /\bastronomy\b/,
    /\becology\b/, /\benvironment\b/, /\bnatural history\b/, /\btechnology\b/,
  ]);
  add('Young Adult', [
    /\byoung adult\b/, /\bteen(?:age|agers?)? fiction\b/,
    /\byouth fiction\b/, /\bya fiction\b/,
  ]);
  add('Children', [
    /\bchildren s (?:books|fiction|literature|stories)\b/, /\bpicture books?\b/,
    /\bmiddle grade\b/,
  ]);

  if (legacy.has('thriller crime')) result.add('Thriller & Mystery');
  if (legacy.has('romance') || legacy.has('romance feelgood')) result.add('Romance');
  if (legacy.has('non fiction')) result.add('Non-fiction');
  if (legacy.has('classics')) result.add('Classics');
  if (legacy.has('contemporary general fiction')) result.add('Contemporary Fiction');
  if (legacy.has('literary general fiction')) result.add('Literary Fiction');

  return CATALOG_CATEGORIES.filter((category) => result.has(category));
}
