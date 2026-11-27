import { PRIORITY_DESTINATIONS } from '../editorial/priority-destinations.ts';
import type { CounterRow } from './report.ts';

/** Consented aggregate events only. A click is neither a page arrival nor a saved book. */
export function readingGuidesReport(rows: readonly CounterRow[]) {
  const production = rows.filter(row => row.dimensions.traffic === 'production');
  const sum = (event: string, match: (row: CounterRow) => boolean = () => true) => production.filter(row => row.event === event && match(row)).reduce((total, row) => total + row.n, 0);
  return {
    destinations: PRIORITY_DESTINATIONS.map(item => ({ id: item.id, path: '/nl' + item.path,
      contentViews: sum('editorial_list_opened', row => row.dimensions.list_id === item.id && ['collection','editorial'].includes(String(row.dimensions.surface))),
      homeClicks: sum('reading_guide_opened', row => row.dimensions.list_id === item.id && row.dimensions.surface === 'home'),
      bookClicks: sum('book_card_opened', row => row.dimensions.list_id === item.id),
    })),
    social: ['facebook','instagram'].map(source => ({ source,
      guideViews: sum('editorial_list_opened', row => row.dimensions.source === source && row.dimensions.campaign === 'leesroutes_202611' && PRIORITY_DESTINATIONS.some(item => item.id === row.dimensions.list_id)),
      confirmedAccountSaves: sum('want_to_read_saved', row => row.dimensions.source === source && row.dimensions.campaign === 'leesroutes_202611'),
      confirmedGuestSaves: sum('guest_book_saved', row => row.dimensions.source === source && row.dimensions.campaign === 'leesroutes_202611'),
      tasteStarts: sum('taste_round_started', row => row.dimensions.source === source && row.dimensions.campaign === 'leesroutes_202611'),
      tasteCompletions: sum('taste_round_completed', row => row.dimensions.source === source && row.dimensions.campaign === 'leesroutes_202611'),
      guestStarts: sum('guest_round_started', row => row.dimensions.source === source && row.dimensions.campaign === 'leesroutes_202611'),
      guestCompletions: sum('guest_round_completed', row => row.dimensions.source === source && row.dimensions.campaign === 'leesroutes_202611'),
    })),
    returningVisitors: null,
    linkedConversion: null,
    note: 'Gebeurtenissen na toestemming, geen unieke bezoekers of gekoppelde conversie. Bevestigde acties zijn apart van klikken. Zonder geïnstalleerde meetuitbreiding ontbreekt de uitsplitsing; historische afwezigheid is geen nulmeting van bezoek. Herhaalbezoek is onbekend zonder bezoekersidentificatie.',
  };
}
