import type { Book } from '../../app/data/books.ts';
import { emptyTasteVector, TASTE_TRAITS, getTraitLabel, type TasteVector } from '../taste-test/traits.ts';
import type { Locale } from '../i18n/config.ts';

export type InterestChoice = { workId: string; decision: 'interested' | 'not-for-me' | 'skip' };
export type MatchCard = { book: Book; traits: TasteVector };
export type MatchSession = { version: 1; seed: string; history: string[]; choices: InterestChoice[] };
const validId = (value: unknown): value is string => typeof value==='string' && /^[1-9]\d{0,14}$/.test(value) && Number.isSafeInteger(Number(value));
export const substantiveCount = (choices: readonly InterestChoice[]) => choices.filter(x=>x.decision!=='skip').length;
export const storageKey = (owner: string, locale: Locale) => `lumiscore-bookmatch-v1:${owner}:${locale}`;
export function swipeDecision(dx:number,dy:number): 'interested'|'not-for-me'|null {
  return Math.abs(dx)>65 && Math.abs(dx)>Math.abs(dy)*1.5 ? dx>0?'interested':'not-for-me':null;
}
export function parseSession(raw: string | null): MatchSession | null {
  if (!raw || raw.length>60000) return null;
  try {
    const x=JSON.parse(raw);
    if (x.version!==1 || typeof x.seed!=='string' || !/^[a-f0-9-]{36}$/.test(x.seed) || !Array.isArray(x.history) || !Array.isArray(x.choices) || x.history.length>1000 || x.choices.length>80) return null;
    if (!x.history.every(validId) || !x.choices.every((c:InterestChoice)=>c && validId(c.workId) && ['interested','not-for-me','skip'].includes(c.decision))) return null;
    if (new Set(x.choices.map((c:InterestChoice)=>c.workId)).size!==x.choices.length || substantiveCount(x.choices)>10) return null;
    return {version:1,seed:x.seed,history:[...new Set(x.history)] as string[],choices:x.choices.map((c:InterestChoice)=>({workId:c.workId,decision:c.decision}))};
  } catch { return null; }
}
export function nextCard(cards: readonly MatchCard[], choices: readonly InterestChoice[]): MatchCard | undefined {
  const seen=new Set(choices.map(x=>x.workId));
  return cards.find(x=>x.book.workId && !seen.has(x.book.workId));
}
export function advice(cards: readonly MatchCard[], choices: readonly InterestChoice[], locale: Locale) {
  const vector=emptyTasteVector(), supports=emptyTasteVector(), seen=new Set(choices.map(x=>x.workId));
  const byId=new Map(cards.map(x=>[x.book.workId,x]));
  const count=substantiveCount(choices);
  for (const choice of choices) {
    if (choice.decision==='skip') continue;
    const traits=byId.get(choice.workId)?.traits;
    if (!traits) continue;
    for (const trait of TASTE_TRAITS) {
      vector[trait]+=traits[trait]*(choice.decision==='interested'?1:-1)/(count+3);
      if (choice.decision==='interested' && traits[trait]>0) supports[trait]++;
    }
  }
  const ranked=cards.filter(x=>x.book.workId && !seen.has(x.book.workId)).map(card=>({card,rank:TASTE_TRAITS.reduce((sum,t)=>sum+vector[t]*card.traits[t],0)+.05*(card.book.score??5.5)/10})).sort((a,b)=>b.rank-a.rank || Number(a.card.book.workId)-Number(b.card.book.workId));
  const card=ranked[0]?.card;
  if (!card) return null;
  const trait=[...TASTE_TRAITS].filter(t=>supports[t]>0 && vector[t]>0 && card.traits[t]>0).sort((a,b)=>vector[b]*card.traits[b]-vector[a]*card.traits[a])[0];
  const reason=trait ? locale==='nl'
    ? `Deelt “${getTraitLabel(locale,trait)}” met ${supports[trait]} boeken die je aanspraken. Dit is interesse, geen beoordeling.`
    : `Shares “${getTraitLabel(locale,trait)}” with ${supports[trait]} books that interested you. This is interest, not a rating.`
    : locale==='nl' ? 'Een verkennend advies: je keuzes bieden nog geen positieve gedeelde kenmerken voor een persoonlijke match.' : 'An exploratory suggestion: your choices do not yet provide positive shared evidence for a personal match.';
  return {card,reason};
}
export function prototypeAllowed(env:{node?:string;vercel?:string;url?:string|null}): boolean {
  if (env.vercel==='production' || !(env.vercel==='preview' || env.node==='development')) return false;
  try {
    const u=new URL(env.url??'');
    return !u.username && !u.password && !u.search && (u.pathname==='/' || u.pathname==='') && (
      u.protocol==='https:' && u.hostname==='hlvujbrmfdlrfxdjwsmb.supabase.co' && !u.port ||
      u.protocol==='http:' && u.hostname==='127.0.0.1' && u.port==='55431');
  } catch { return false; }
}
export function parseDeckQuery(url: URL) {
  if ([...url.searchParams.keys()].some(k=>!['seed','seen'].includes(k)) || ['seed','seen'].some(k=>url.searchParams.getAll(k).length>1)) return null;
  const seed=url.searchParams.get('seed')??'', seen=url.searchParams.get('seen')??'';
  if (!/^[a-f0-9-]{36}$/.test(seed) || seen.length>16000) return null;
  const ids=seen ? seen.split(',') : [];
  if(ids.length>1000 || !ids.every(validId)) return null;
  return {seed,seen:new Set(ids)};
}
export function shuffleRank(seed: string, id: string): number {
  let hash=2166136261;
  for(const char of `${seed}:${id}`) hash=Math.imul(hash^char.charCodeAt(0),16777619);
  return hash>>>0;
}
