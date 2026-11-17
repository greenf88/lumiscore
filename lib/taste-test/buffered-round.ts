import type {Book} from '../../app/data/books.ts';
import type {RatingRoundState} from './rating-round.ts';
export type BufferedDecision={workId:string;score:number|null};
export type BufferedRound={authenticated:boolean;available:boolean;owner?:string;state:RatingRoundState|null;books:Book[]};
export const draftKey=(owner:string,round:string)=>`lumiscore-round-draft-v1:${owner}:${round}`;
export const DRAFT_TTL=24*60*60*1000;
export function parseBufferedDecisions(input:unknown):BufferedDecision[]|null {
  if(!Array.isArray(input)||input.length>120)return null;
  const ids=new Set<string>();
  for(const d of input){
    if(!d||typeof d!=='object'||Object.keys(d).length!==2||typeof d.workId!=='string'||!/^[1-9][0-9]{0,14}$/.test(d.workId)||ids.has(d.workId)
      ||!(d.score===null||(Number.isInteger(d.score)&&d.score>=1&&d.score<=10)))return null;
    ids.add(d.workId);
  }
  return input as BufferedDecision[];
}
export function readBufferedDraft(raw:string|null,now=Date.now()):{decisions:BufferedDecision[];expires:number}|null {
  try{const value=JSON.parse(raw??'null');if(!value||!Number.isFinite(value.expires)||value.expires<=now||value.expires>now+DRAFT_TTL)return null;
    const decisions=parseBufferedDecisions(value.decisions);return decisions?{decisions,expires:value.expires}:null;
  }catch{return null;}
}
