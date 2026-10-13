import { editorialHref, type EditorialQuery } from './editorial-query.ts';
import type { AuthorOption, PublicCategory } from './discovery.ts';
import type { Locale } from '../i18n/config.ts';

export function browseFilterGroupCount(state: EditorialQuery): number {
  return [Boolean(state.query), Boolean(state.author), state.categories.length > 0,
    Boolean(state.selection), state.languages.length > 0].filter(Boolean).length;
}

export function clearBrowseFilters(state: EditorialQuery): EditorialQuery {
  return { ...state, page: 1, query: '', author: '', categories: [], languages: [], selection: '' };
}

/** Links go through the existing normalized URL contract, never an arbitrary return URL. */
export function browseFilterChips(state: EditorialQuery, categories: PublicCategory[], author: AuthorOption | null, locale: Locale) {
  const nl = locale === 'nl';
  const href = (next: Partial<EditorialQuery>) => editorialHref('/browse', { ...state, ...next, page: 1 });
  return [
    ...(state.query ? [{ key: 'q', label: `${nl ? 'Zoeken' : 'Search'}: ${state.query}`, href: href({ query: '' }) }] : []),
    ...(state.author ? [{ key: 'author', label: `${nl ? 'Schrijver' : 'Author'}: ${author?.name ?? `#${state.author}`}`, href: href({ author: '' }) }] : []),
    ...state.categories.map(id => ({ key: `category-${id}`, label: categories.find(c => c.id === id)?.[locale] ?? id,
      href: href({ categories: state.categories.filter(value => value !== id) }) })),
    ...(state.selection ? [{ key: 'selection', label: nl ? 'LumiScore Selectie' : 'LumiScore Selection', href: href({ selection: '' }) }] : []),
    ...state.languages.map(id => ({ key: `language-${id}`, label: `${nl ? 'Edities' : 'Editions'}: ${id === 'nl' ? 'Nederlands' : 'English'}`,
      href: href({ languages: state.languages.filter(value => value !== id) }) })),
  ];
}
