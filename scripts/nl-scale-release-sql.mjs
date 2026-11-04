// Reuse the single existing CAS/FK renderer. Opt in only this research phase.
// Historical packages retain byte-identical default SQL and name-key behaviour.
import{renderImport as sharedImport,renderRollback as sharedRollback}from'./catalog-release-sql.mjs';
export const renderImport=(plan,options={})=>sharedImport(plan,{...options,indexed:true});
export const renderRollback=plan=>sharedRollback(plan,{indexed:true});
