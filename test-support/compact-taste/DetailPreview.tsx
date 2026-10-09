// Real detail component, local synthetic identity, no hosted writes or Auth credentials.
import { LumiScoreBookDetail } from '../../app/components/LumiScoreBookDetail';
import { EMPTY_RATING_STATE } from '../../lib/ratings/model';

export function DetailPreview() {
  return <LumiScoreBookDetail description={null} book={{ id: 'local-typography-detail', source: 'demo', workId: '991001',
    title: 'De uitzonderlijk lange geschiedenis van een huis tussen de sterren', author: 'Synthetische Auteur met een Lange Naam',
    firstPublishYear: 1998, score: null, ratingsCount: null, match: null, cover: 'orbit', coverUrls: ['/compact-cover.svg'] }}
    initialRatingState={EMPTY_RATING_STATE} initialReadingStatus={null} collectionContext={null}
    personalization={{ authenticated: false, hasEvidence: false, candidate: null, match: null }}
    authState={{ authenticated: false }} returnNavigation={{ kind: 'home', href: '/' }} />;
}
