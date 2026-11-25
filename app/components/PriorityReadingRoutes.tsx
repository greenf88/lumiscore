import { LocaleLink } from './LumiScoreLocale';
import { PRIORITY_DESTINATIONS } from '@/lib/editorial/priority-destinations';

export function PriorityReadingRoutes() {
  return <section className="featured-section priority-reading-routes" aria-labelledby="priority-reading-title">
    <p className="eyebrow">Redactionele keuzehulp</p>
    <h2 id="priority-reading-title">Een volgend boek kiezen</h2>
    <p>Begin bij een leesvraag. Deze gidsen zijn voor iedereen leesbaar en vormen geen ranglijst op gebruikersscore.</p>
    <ul className="priority-reading-grid">{PRIORITY_DESTINATIONS.map(item => <li key={item.id}>
      <h3><LocaleLink href={item.path}>{item.title}<span aria-hidden="true"> →</span></LocaleLink></h3>
      <p>{item.description}</p>
    </li>)}</ul>
  </section>;
}
