type Counts={books:number;summaries:number;covers:number};
/** Operational public-data diagnostics, never a tracking event. Keys stay in
 * bounded process memory; logs contain no Work IDs, queries or reader state. */
export class PresentationCoverage {
 private previous=new Map<string,{at:number;counts:Counts}>();
 private now:()=>number;private log:(value:Record<string,unknown>)=>void;
 constructor(now=Date.now,log=(value:Record<string,unknown>)=>console.warn(JSON.stringify(value))){this.now=now;this.log=log;}
 observe(key:string,locale:string,counts:Counts){
  const prior=this.previous.get(key),now=this.now();
  if(prior&&now-prior.at<5*60000&&prior.counts.books===counts.books){
   const drops=(['summaries','covers'] as const).filter(field=>prior.counts[field]>0&&counts[field]<=prior.counts[field]*.75);
   if(drops.length)this.log({event:'catalog_presentation_coverage_drop',locale,books:counts.books,
    beforeSummaries:prior.counts.summaries,afterSummaries:counts.summaries,beforeCovers:prior.counts.covers,afterCovers:counts.covers,
    cause:'successful_read_same_selection',fields:drops});
  }
  this.previous.set(key,{at:now,counts});while(this.previous.size>200)this.previous.delete(this.previous.keys().next().value!);
 }
}
