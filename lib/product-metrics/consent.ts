export const ANALYSIS_VERSION=1;
export const CHOICE_COOKIE='lumiscore_analysis_choice_v1';
export const GRANT_COOKIE='lumiscore_analysis_grant_v1';
export const GRANT_HEADER='x-lumiscore-analysis-grant';
export const CHOICE_AGE_MS=90*86400_000;
export type AnalysisChoice='accepted'|'denied'|'unknown';
export function parseAnalysisReply(value:unknown):{choice:AnalysisChoice;active:boolean;expires:number;pending:boolean}{
 if(!value||typeof value!=='object')throw Error('Invalid consent response');
 const v=value as Record<string,unknown>;
 if(v.version!==ANALYSIS_VERSION||!['accepted','denied','unknown'].includes(String(v.choice))||typeof v.active!=='boolean'||typeof v.expires!=='number'||typeof v.pending!=='boolean')throw Error('Invalid consent response');
 const active=v.choice==='accepted'&&v.active&&v.expires>Date.now()&&v.expires<=Date.now()+30*60_000;
 return{choice:v.choice as AnalysisChoice,active,expires:active?v.expires:0,pending:v.pending};
}
export function parseAnalysisChoice(value:string|undefined,now=Date.now()):AnalysisChoice{
 const m=/^1\.(a|d)\.(\d{13})$/.exec(value??'');if(!m)return 'unknown';
 const expires=Number(m[2]);return expires>now&&expires<=now+CHOICE_AGE_MS?m[1]==='a'?'accepted':'denied':'unknown';
}
export const analysisChoiceValue=(choice:'accepted'|'denied',now=Date.now())=>`1.${choice==='accepted'?'a':'d'}.${now+CHOICE_AGE_MS}`;
export function parseAnalysisGrant(value:string|undefined,now=Date.now()):string|null{
 const m=/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.(\d{13})$/i.exec(value??'');return m&&Number(m[2])>now&&Number(m[2])<=now+30*60_000?m[1]:null;
}
export const grantedAnalysisToken=(choice:string|undefined,grant:string|undefined,now=Date.now())=>parseAnalysisChoice(choice,now)==='accepted'?parseAnalysisGrant(grant,now):null;
