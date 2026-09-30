'use client';
import { editorialCategories, selectionSlug, editorialHref, type EditorialQuery } from '@/lib/catalog/editorial-query';
import { useLumiScoreLocale } from './LumiScoreLocale';
export function EditorialCatalogControls({ state, facets, route }: {
  state: EditorialQuery; facets: Record<string, number>; route: '/browse' | '/search';
}) {
  const { locale } = useLumiScoreLocale();
  const nl = locale === 'nl';
  return (
    <form className="editorial-controls" action={route} method="get">
      {route === '/search' && <label>{nl ? 'Titel of auteur' : 'Title or author'}
        <input name="q" defaultValue={state.query} maxLength={100} />
      </label>}
      <details>
        <summary>{nl ? 'Categorieën' : 'Categories'}{state.categories.length > 0 ? ` (${state.categories.length})` : ''}</summary>
        <fieldset className="editorial-category-list">
          <legend>{nl ? 'Eén of meer genres (of)' : 'One or more genres (OR)'}</legend>
          {editorialCategories.map(c => <label key={c.id}>
            <input type="checkbox" name="category" value={c.id} defaultChecked={state.categories.includes(c.id)} />
            {nl ? c.nl : c.en} <span>({facets[c.id] ?? 0})</span>
          </label>)}
        </fieldset>
      </details>
      <label>{nl ? 'Selectie' : 'Selection'}
        <select name="selection" defaultValue={state.selection}>
          <option value="">{nl ? 'Alle boeken' : 'All books'}</option>
          <option value={selectionSlug}>{nl ? 'LumiScore Selectie 1000' : 'LumiScore Selection 1000'}</option>
        </select>
      </label>
      <fieldset className="editorial-languages">
        <legend>{nl ? 'Beschikbare edities' : 'Available editions'}</legend>
        {(['nl', 'en'] as const).map(code => <label key={code}><input type="checkbox" name="language" value={code}
          defaultChecked={state.languages.includes(code)} />{code === 'nl' ? 'Nederlands' : 'English'}</label>)}
      </fieldset>
      <label>{nl ? 'Sortering' : 'Sort'}
        <select name="sort" defaultValue={state.sort}>
          <option value="az">A–Z</option><option value="newest">{nl ? 'Nieuwste eerst' : 'Newest first'}</option>
        </select>
      </label>
      <label>{nl ? 'Boeken per pagina' : 'Books per page'}
        <select name="pageSize" defaultValue={state.pageSize}>{[32,64,128].map(size => <option key={size}>{size}</option>)}</select>
      </label>
      <button type="submit">{nl ? 'Toepassen' : 'Apply'}</button>
      <a href={route}>{nl ? 'Filters wissen' : 'Clear filters'}</a>
      {state.selection && <p className="editorial-selection-note">{nl
        ? 'Redactionele selectie, geen ranglijst. Aantallen tonen de beschikbare, gekoppelde werken; onzekere records zijn nog niet opgenomen.'
        : 'Editorial selection, not a ranking. Counts show available linked works; unresolved records are not yet included.'}</p>}
    </form>
  );
}
export function EditorialPagination({ state, pageCount, route }: { state: EditorialQuery; pageCount: number; route: '/browse' | '/search' }) {
  const { locale } = useLumiScoreLocale();
  if (pageCount <= 1) return null;
  return <nav className="browse-pagination" aria-label={locale === 'nl' ? 'Paginering' : 'Pagination'}>
    {state.page > 1 && <a rel="prev" href={editorialHref(route, { ...state, page: state.page - 1 })}>{locale === 'nl' ? 'Vorige' : 'Previous'}</a>}
    <span>{state.page} / {pageCount}</span>
    {state.page < pageCount && <a rel="next" href={editorialHref(route, { ...state, page: state.page + 1 })}>{locale === 'nl' ? 'Volgende' : 'Next'}</a>}
  </nav>;
}
