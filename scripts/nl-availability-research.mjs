export function inheritWorkResearch(old,work){
 const matches=!!old&&old.title===work.title&&old.authorId===work.author_id&&old.openLibraryWorkId===work.open_library_id;
 if(!matches)return {inheritedIdentityMatches:false,previousKey:old?.key??null,previousSourceAttempts:[],previousSourcePoorStatus:null,previousConflictDecision:null};
 return {inheritedIdentityMatches:true,previousKey:old.key,previousSourceAttempts:old.sourceAttempts??old.research?.previousSourceAttempts??[],previousSourcePoorStatus:old.sourcePoorResearch?.researchStatus??old.research?.previousSourcePoorStatus??null,previousConflictDecision:old.additionalSourceAdjudication??old.authorAuthorityDecision??old.research?.previousConflictDecision??null};
}
export function substantiveAssessment(row,followup){
 const nl=row.presentations.nl;
 const summaryLanguages=['nl','en'].filter(l=>row.presentations[l]?.summary?.state==='approved_stored_source_bound');
 const conflict=row.status==='identity_or_source_conflict'||followup?.status==='identity_review_required';
 const outcome=row.status==='suitable_NL_present_correctly_visible'?'approved_existing_NL_presentation':conflict?'identity_conflict':row.proposal?'approved_correction_proposed_test_not_production':summaryLanguages.length?'partially_reviewed_approved_stored_content':followup?'partially_reviewed_Dutch_edition_evidence':'insufficient_evidence_further_sources_required';
 return {outcome,scope:'Per-aspect evidence, not a claim that every possible Dutch edition/source has been exhausted',approvedStoredSummaryLanguages:summaryLanguages,DutchEdition:nl.eligible?'technically_eligible_not_automatically_substantively_approved':row.proposal?'reviewed_proposal_not_production':followup?'verified_external_candidate_not_import_ready':'not_yet_established_not_equated_to_nonexistence',cover:nl.cover?.actualBrowser?.environment==='production'?'actual_production_decode_and_identity_proof':nl.cover?.state??'not_applicable_until_edition_chosen',followup:followup?{file:'research-batch-002.json',status:followup.status,remaining:followup.remaining}:null,finalUnresolvableException:false};
}
