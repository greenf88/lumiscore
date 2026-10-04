// Real SQL/API assertions. No credential loading, target selection or provisioning.
import assert from 'node:assert/strict';
export const permissionsMigration = '20261004120823_discovery_taste_state_permissions.sql';
export const functionContracts = [
  ['public.catalog_discovery_page(text,text[],text,text[],text,integer,integer,bigint[],bigint)', true, false],
  ['public.taste_rating_state()', false, false],
  ['public.taste_rating_advance(text,uuid,bigint,integer,text)', false, false],
  ['taste_private.advance_round(text,uuid,bigint,integer,text)', false, true],
];
export async function verifyFunctionPermissions(db) {
  for (const [signature, anonymous, definer] of functionContracts) {
    const { rows: [row] } = await db.query(`select
      pg_get_userbyid(p.proowner) as owner, p.prosecdef as definer,
      has_function_privilege('anon',p.oid,'EXECUTE') as anonymous,
      has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated,
      exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        where a.grantee=0 and a.privilege_type='EXECUTE') as public_execute,
      exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        where a.privilege_type='EXECUTE' and a.grantee<>p.proowner
        and a.grantee not in (select oid from pg_roles where rolname in ('anon','authenticated','service_role'))) as unexpected_execute
      from pg_proc p where p.oid=to_regprocedure($1)`, [signature]);
    assert.ok(row, 'Required exact function signature absent');
    assert.equal(row.anonymous, anonymous, 'Effective anon EXECUTE differs from contract');
    assert.equal(row.authenticated, true, 'Authenticated EXECUTE required');
    assert.equal(row.public_execute, false, 'PUBLIC EXECUTE forbidden');
    assert.equal(row.unexpected_execute, false, 'Unplanned EXECUTE grantee');
    assert.equal(row.definer, definer, 'Function execution mode changed');
    assert.equal(row.owner, 'postgres', 'Function owner differs from approved model');
  }
  return { exactFunctions: 4, anonymousStateExecute: false, authenticatedStateExecute: true, publicExecute: false };
}
export async function verifyAnonymousTasteApi(anon) {
  const response = await anon.rpc('taste_rating_state');
  assert.ok(response.error, 'Anonymous state RPC must be denied');
  assert.equal(response.error.code, '42501', 'State RPC must fail on actual permission denial, not missing schema');
  for (const table of ['taste_rating_rounds','taste_rating_offers']) {
    const result = await anon.from(table).select('*').limit(1);
    assert.ok(result.error, 'Anonymous table read must be denied');
    assert.equal(result.error.code, '42501', 'Actual table permission denial required');
  }
  return { realAnonymousRpcDenied: true, anonymousTablesDenied: true };
}
