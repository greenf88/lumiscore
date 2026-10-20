'use client';

import { useEffect, useRef, useState } from 'react';
import { selectionSlug, type EditorialQuery } from '@/lib/catalog/editorial-query';
import { browseFilterChips, browseFilterGroupCount } from '@/lib/catalog/browse-controls';
import type { AuthorOption, PublicCategory } from '@/lib/catalog/discovery';
import { localizedHref } from '@/lib/i18n/paths';
import { LocaleLink, useLumiScoreLocale } from './LumiScoreLocale';

type Props = {
  state: EditorialQuery;
  categories: PublicCategory[];
  facets: Record<string, number>;
  selectedAuthor: AuthorOption | null;
  selectionCount: number | null;
  discoveryAvailable: boolean;
  resultCount: number | null;
  route?: '/browse' | '/search';
};

function AppliedFields({ state, omit }: { state: EditorialQuery; omit: 'q' | 'sort' }) {
  return <>
    {omit !== 'q' && <input type="hidden" name="q" value={state.query} />}
    {omit !== 'sort' && <input type="hidden" name="sort" value={state.relevance ? 'relevance' : state.sort} />}
    <input type="hidden" name="author" value={state.author} />
    <input type="hidden" name="selection" value={state.selection} />
    <input type="hidden" name="pageSize" value={state.pageSize} />
    {state.categories.map(id => <input type="hidden" name="category" value={id} key={id} />)}
    {state.languages.map(id => <input type="hidden" name="language" value={id} key={id} />)}
  </>;
}

export function BrowseCatalogControls({ state, categories, facets, selectedAuthor, selectionCount, discoveryAvailable, resultCount, route = '/browse' }: Props) {
  const { locale, t } = useLumiScoreLocale();
  const nl = locale === 'nl';
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const search = route === '/search';
  const count = browseFilterGroupCount(search ? { ...state, query: '' } : state);
  const chips = browseFilterChips(state, categories, selectedAuthor, locale, route);
  const clearHref = search && state.query ? '/search?q=' + encodeURIComponent(state.query) : route;
  const action = localizedHref(route, locale);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    if (open) panel.current?.querySelector<HTMLElement>('input:not([type="hidden"]), select, button')?.focus({ preventScroll: true });
  }, [open]);

  return <div className="browse-discovery-controls">
    <form className="browse-search" action={action} method="get" role="search" aria-label={t('browse.search')}>
      <label className="sr-only" htmlFor="browse-query">{t('browse.searchPlaceholder')}</label>
      <input id="browse-query" type="search" name="q" defaultValue={state.query} maxLength={100}
        placeholder={t('browse.searchPlaceholder')} />
      <AppliedFields state={state} omit="q" />
      <button type="submit">{t('browse.search')}</button>
    </form>

    <div className="browse-control-row">
      <button ref={trigger} type="button" className="browse-filter-trigger" aria-expanded={open}
        aria-controls="browse-filter-panel" onClick={() => open ? close() : setOpen(true)}>
        {t('browse.filters')}{count > 0 && <span className="browse-filter-count" aria-label={t(count === 1 ? 'browse.activeGroupOne' : 'browse.activeGroups', { count })}>{count}</span>}
      </button>
      {!search && <form className="browse-sort" action={action} method="get">
        <AppliedFields state={state} omit="sort" />
        <label htmlFor="browse-sort">{t('browse.sortCompact')}</label>
        <select id="browse-sort" name="sort" defaultValue={state.sort}
          onChange={event => event.currentTarget.form?.requestSubmit()}>
          <option value="az">A–Z</option>
          <option value="newest">{t('browse.sortNewest')}</option>
          {discoveryAvailable && <option value="highest">{t('browse.sortHighest')}</option>}
        </select>
        <noscript><button type="submit">{t('browse.sortCompact')}</button></noscript>
      </form>}
      {!search && count > 0 && resultCount !== null && <p className="browse-result-count" role="status">
        {t(resultCount === 1 ? 'browse.resultCountOne' : 'browse.resultCount', { count: resultCount.toLocaleString(nl ? 'nl-NL' : 'en-US') })}
      </p>}
    </div>

    {open && <div ref={panel} id="browse-filter-panel" className="browse-filter-panel" role="region"
      aria-labelledby="browse-filter-title" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); close(); } }}>
      <div className="browse-panel-heading"><h2 id="browse-filter-title">{t('browse.filters')}</h2>
        <button type="button" onClick={close} aria-label={t('browse.closeFilters')}>×</button></div>
      <form action={action} method="get" className="browse-filter-form">
        <input type="hidden" name="q" value={state.query} />
        {search ? <label className="search-filter-sort">{nl ? 'Sortering' : 'Sort'}
          <select name="sort" defaultValue={state.relevance ? 'relevance' : state.sort}>
            {state.query.length >= 2 && <option value="relevance">{nl ? 'Relevantie' : 'Relevance'}</option>}
            <option value="az">A–Z</option>
            <option value="newest">{t('browse.sortNewest')}</option>
            {discoveryAvailable && <option value="highest">{t('browse.sortHighest')}</option>}
          </select>
        </label> : <input type="hidden" name="sort" value={state.sort} />}
        {state.author && <input type="hidden" name="author" value={state.author} />}
        <fieldset className="browse-selection"><legend>{t('browse.selection')}</legend>
          <div className="browse-choice-tiles browse-selection-tiles">
            <label><input type="radio" name="selection" value="" aria-label={t('browse.allBooks')} defaultChecked={!state.selection} /><span>{t('browse.allBooks')}</span></label>
            <label><input type="radio" name="selection" value={selectionSlug} aria-label={t('browse.curatedSelection')} defaultChecked={Boolean(state.selection)} />
              <span>{t('browse.curatedSelection')}{search || selectionCount === null ? null : <small>{selectionCount.toLocaleString(nl ? 'nl-NL' : 'en-US')}</small>}</span></label>
          </div>
        </fieldset>
        <fieldset className="browse-display-options"><legend>{t('browse.pageSize')}</legend>
          <div className="browse-choice-tiles browse-size-tiles">
            {[16, 32, 64, 128].map(size => <label key={size}>
              <input type="radio" name="pageSize" value={size} aria-label={String(size)} defaultChecked={state.pageSize === size} />
              <span>{size}</span>
            </label>)}
          </div>
        </fieldset>
        {categories.length > 0 ? <fieldset className="browse-category-options">
          <legend>{t('browse.categories')}</legend>
          <div>{categories.map(category => <label key={category.id}>
            <input type="checkbox" name="category" value={category.id} defaultChecked={state.categories.includes(category.id)} />
            <span>{category[locale]} {!search && <small>({facets[category.id] ?? 0})</small>}</span>
          </label>)}</div>
        </fieldset> : null}
        {state.categories.filter(id => !categories.some(category => category.id === id))
          .map(id => <input type="hidden" name="category" value={id} key={id} />)}
        <fieldset className="browse-edition-options"><legend>{t('browse.editions')}</legend>
          {(['nl', 'en'] as const).map(code => <label key={code}>
            <input type="checkbox" name="language" value={code} defaultChecked={state.languages.includes(code)} />
            {code === 'nl' ? 'Nederlands' : 'English'}
          </label>)}
        </fieldset>
        <div className="browse-filter-actions">
          <button type="submit" className="browse-apply">{t('browse.applyFilters')}</button>
          <button type="submit" form="browse-clear-form" className="browse-clear">{t('browse.clearFilters')}</button>
        </div>
      </form>
      {search ? <form id="browse-clear-form" action={action} method="get">
        {state.query && <input type="hidden" name="q" value={state.query} />}
      </form> : <form id="browse-clear-form" action={action} method="get" />}
      <button type="button" className="browse-text-action browse-cancel" onClick={close}>{t('browse.cancel')}</button>
    </div>}

    {chips.length > 0 && <nav className="browse-active-filters" aria-label={t('browse.activeFilters')}>
      {chips.map(chip => <LocaleLink key={chip.key} href={chip.href} className="browse-filter-chip"
        aria-label={t('browse.removeFilter', { filter: chip.label })}>{chip.label}<span aria-hidden="true">×</span></LocaleLink>)}
      <LocaleLink href={clearHref} className="browse-text-action">{t('browse.clearAll')}</LocaleLink>
    </nav>}
  </div>;
}
