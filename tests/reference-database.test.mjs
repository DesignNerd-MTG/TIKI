import assert from "node:assert/strict";
import { before, after, describe, it } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { checkReference } from "../src/lib/reference-fetch.ts";
import { referenceCollections } from "../src/lib/references.ts";

const db=new PGlite();
const ids={admin:"11111111-1111-4111-8111-111111111111",editor:"22222222-2222-4222-8222-222222222222",contributor:"33333333-3333-4333-8333-333333333333",viewer:"44444444-4444-4444-8444-444444444444",pending:"55555555-5555-4555-8555-555555555555"};
let legacyId;
async function as(role){await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[role]]);await db.exec("set role authenticated");}
const manifest=[{import_source:"notion:aaaaaaaaaaaa4aaa8aaaaaaaaaaaaaaa",label:"Imported resource",url:"https://www.etcconnect.com",description:"Old source",date_added:"2022-03-04T10:30:00Z",collection_id:"control-systems",subcollection_id:null,category:"Control Systems",tags:["console"],link_health:"redirected",site_name:"Lighting maker",final_url:"https://www.etcconnect.com/new",last_checked_at:"2026-09-13T00:00:00Z"}];

before(async()=>{
  await db.exec(`create role authenticated; create role anon; create role service_role; create schema auth;
    alter default privileges grant execute on functions to anon, authenticated, service_role;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;`);
  const directory=new URL("../supabase/migrations/",import.meta.url);
  const migrations=(await readdir(directory)).filter(name=>name.endsWith(".sql")).sort();
  for(const name of migrations){
    if(name==="202609130001_reference_hub.sql"){
      for(const [role,id] of Object.entries(ids)){
        await db.query("insert into auth.users(id,email) values($1,$2)",[id,role+"@test.invalid"]);
        await db.query("update public.profiles set role=$1::public.app_role,active=$2 where id=$3",[role==="pending"?"viewer":role,role!=="pending",id]);
      }
      const result=await db.query("insert into public.link_items(label,url,category,status,created_by,created_at,updated_at) values('Legacy link','https://public.com','Drafting','published',$1,'2020-01-01T12:30:00.123456Z','2021-02-03T04:05:06.654321Z') returning id",[ids.admin]);
      legacyId=result.rows[0].id;
    }
    if(name==="202609140001_social_account_admin.sql"){
      await db.query("insert into public.profile_social_links(profile_id,label,url) values($1,'Ambiguous legacy','https://example.com/legacy')",[ids.viewer]);
      const old=(await db.query("select * from public.profile_social_links")).rows;
      await db.exec(await readFile(new URL(name,directory),"utf8"));
      assert.deepEqual((await db.query("select * from public.profile_social_links")).rows,old);
      await db.query("delete from public.profile_social_links where id=$1",[old[0].id]);
    }else if(name==="202609130002_ldg_documents_collection.sql"){
      const taxonomy=(await db.query("select * from public.reference_collections order by id")).rows;
      const links=(await db.query("select * from public.link_items order by id")).rows;
      await db.exec(await readFile(new URL(name,directory),"utf8"));
      assert.deepEqual((await db.query("select * from public.reference_collections where id <> 'ldg-ldge-documents' order by id")).rows,taxonomy);
      assert.deepEqual((await db.query("select * from public.link_items order by id")).rows,links);
    }else{
      await db.exec(await readFile(new URL(name,directory),"utf8"));
    }
  }
});
after(async()=>{await db.close();});
describe("Reference PostgreSQL migration and RLS",()=>{
  it("orders last-name keys before directory page limits with active-only public fields",async()=>{
    await db.exec('reset role');
    const names=['Romi Smith','Sarah Lynn Jakubasz','Mike Grabowski','Jane Adams','zoe adams','jane ADAMS','Prince'];
    const people=names.map((_,i)=>`77777777-7777-4777-8777-${String(i).padStart(12,'0')}`);
    for(let i=0;i<names.length;i++) {
      await db.query("insert into auth.users(id,email) values($1,$2)",[people[i],`sort${i}@test.invalid`]);
      await db.query("update public.profiles set full_name=$1,active=true where id=$2",[names[i],people[i]]);
      await db.query("insert into public.profile_social_links(profile_id,label,url) values($1,'Instagram','https://instagram.com/test')",[people[i]]);
    }
    const expected=[3,5,4,2,1,6,0].map(i=>people[i]);
    for(const actor of ['viewer','admin']) {
      await as(actor);
      const fetched=[];
      for(let offset=0;offset<names.length;offset+=2) {
        const rows=(await db.query('select * from public.social_directory_index() order by last_name_key,display_name_key,profile_id,id limit 2 offset $1',[offset])).rows;
        fetched.push(...rows.map(r=>r.profile_id));
        assert.deepEqual(Object.keys(rows[0]).sort(),['display_name','display_name_key','id','label','last_name_key','profile_id','url']);
      }
      assert.deepEqual(fetched,expected);
    }
    await as('pending');assert.equal((await db.query('select * from public.social_directory_index()')).rows.length,0);
    await db.exec('reset role; set role anon');
    await assert.rejects(()=>db.query('select * from public.social_directory_index()'),e=>e.code==='42501');
    await db.exec('reset role');
    await db.query('delete from auth.users where id=any($1::uuid[])',[people]);
  });
  it("sorts the full filtered Reference index before paging with historical dates and stable ties",async()=>{
    await as('admin');
    const rows=[];
    for(let i=0;i<55;i++) {
      rows.push((await db.query("insert into public.link_items(label,url,description,collection_id,subcollection_id,date_added,status,created_by) values($1,'https://example.com','SORT_TEST','control-systems','consoles',$2,'published',$3) returning id,label,date_added",[i<2?' alpha ':`Title ${String(55-i).padStart(2,'0')}`,i%2?'2000-01-01':'2020-01-01',ids.admin])).rows[0]);
    }
    const get=async(sort,offset=0,archived=false)=>(await db.query("select id,label,date_added from public.search_reference_index('SORT_TEST','control-systems','consoles',$1,$2,$3)",[archived,offset,sort])).rows;
    for(const sort of ['title-asc','title-desc','newest','oldest']) {
      const expected=[...rows].sort((a,b)=>{
        const title=a.label.trim().toLowerCase().localeCompare(b.label.trim().toLowerCase());
        const date=new Date(a.date_added)-new Date(b.date_added);
        return (sort==='newest'?-date:sort==='oldest'?date:0)||(sort==='title-desc'?-title:title)||a.id.localeCompare(b.id);
      });
      const actual=[...(await get(sort)).slice(0,50),...await get(sort,50)];
      assert.deepEqual(actual.map(r=>r.id),expected.map(r=>r.id));
    }
    assert.deepEqual((await get('bad')).map(r=>r.id),(await get('title-asc')).map(r=>r.id));
    await db.query("update public.link_items set status='archived' where description='SORT_TEST'");
    assert.equal((await get('oldest')).length,0);
    assert.equal((await get('oldest',0,true)).length,51);
    await as('pending');assert.equal((await get('title-asc')).length,0);
    await db.exec('reset role; set role anon');
    await assert.rejects(()=>get('title-asc'),e=>e.code==='42501');
    await db.exec('reset role');await db.query("delete from public.link_items where description='SORT_TEST'");
  });
  it("lets active members supply only their own public name without changing role or exposing private fields",async()=>{
    await as('viewer');
    await db.query("select public.set_directory_display_name($1)",['  Mike Grabowski  ']);
    const own=(await db.query('select full_name,role,active from public.profiles where id=$1',[ids.viewer])).rows[0];
    assert.deepEqual(own,{full_name:'Mike Grabowski',role:'viewer',active:true});
    await assert.rejects(()=>db.query("select public.set_directory_display_name('   ')"));
    await db.query("insert into public.profile_social_links(profile_id,label,url) values($1,'Instagram','https://instagram.com/namecheck')",[ids.viewer]);
    for(const role of ['viewer','contributor','admin']) {
      await as(role);
      const rows=(await db.query('select * from public.social_directory()')).rows;
      assert.equal(rows.find(r=>r.profile_id===ids.viewer).display_name,'Mike Grabowski');
      assert.deepEqual(Object.keys(rows[0]).sort(),['display_name','id','label','profile_id','url']);
    }
    await as('viewer');await db.query('delete from public.profile_social_links where profile_id=$1',[ids.viewer]);
    await as('pending');await assert.rejects(()=>db.query("select public.set_directory_display_name('Pending')"),e=>e.code==='42501');
    await db.exec('reset role; set role anon');
    await assert.rejects(()=>db.query("select public.set_directory_display_name('Guest')"),e=>e.code==='42501');
    await db.exec('reset role');
  });
  it("anonymous and inactive users cannot read department content directly or through reference RPCs",async()=>{
    await db.exec('reset role');
    const tables=(await db.query("select tablename from pg_tables where schemaname='public' and tablename not in ('profiles','portal_settings')")).rows;
    for(const actor of ['anon','pending']) {
      if(actor==='pending') await as('pending');
      else await db.exec("select set_config('request.jwt.claim.sub','',false); set role anon");
      for(const {tablename} of tables) {
        try { assert.equal((await db.query(`select * from public."${tablename}"`)).rows.length,0,`${actor}: ${tablename}`); }
        catch(error) { if(error.code!=='42501') throw error; }
      }
      for(const sql of ["select * from public.search_references('')",'select * from public.reference_collection_counts()','select * from public.social_directory()']) {
        try { assert.equal((await db.query(sql)).rows.length,0,actor+sql); }
        catch(error) { if(error.code!=='42501') throw error; }
      }
      await db.exec('reset role');
    }
  });
  it("signup cannot self-activate and private Travel rows stay owner-only even for Admin",async()=>{
    await db.exec('reset role');
    const fresh='66666666-6666-4666-8666-666666666666';
    await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'signup@test.invalid',$2)",[fresh,JSON.stringify({role:'admin',active:true,full_name:'New member'})]);
    assert.deepEqual((await db.query('select role,active from public.profiles where id=$1',[fresh])).rows[0],{role:'viewer',active:false});
    await as('viewer');
    await db.query("insert into public.travel_profiles(user_id,details) values($1,'PRIVATE_TRAVEL_SENTINEL')",[ids.viewer]);
    for(const actor of ['admin','contributor','pending']) {
      await as(actor);
      assert.equal((await db.query('select * from public.travel_profiles where user_id=$1',[ids.viewer])).rows.length,0);
      assert.equal((await db.query("select * from public.search_references('PRIVATE_TRAVEL_SENTINEL')")).rows.length,0);
    }
    await db.exec('reset role');
    await db.query('delete from public.travel_profiles where user_id=$1',[ids.viewer]);
    await db.query('delete from auth.users where id=$1',[fresh]);
  });
  it("denies anonymous function execution even with a forged subject and Supabase default grants",async()=>{
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids.admin]);
    await db.exec("set role anon");
    for(const sql of ["select * from public.social_account_targets()",`select public.social_account_target_active('${ids.viewer}')`]) {
      await assert.rejects(()=>db.query(sql),error=>error.code==='42501' && /permission denied for function/.test(error.message));
    }
    await db.exec("reset role");
    for(const signature of ['public.social_account_targets()','public.social_account_target_active(uuid)']) {
      for(const role of ['anon','service_role','authenticated']) {
        assert.equal((await db.query("select has_function_privilege($1,$2,'EXECUTE') allowed",[role,signature])).rows[0].allowed,role==='authenticated');
      }
      const fn=(await db.query("select prosecdef,proconfig,pg_get_userbyid(proowner) owner from pg_proc where oid=$1::regprocedure",[signature])).rows[0];
      assert.equal(fn.prosecdef,true);assert.ok(fn.proconfig.includes('search_path=""'));
      assert.equal((await db.query("select count(*)::int n from pg_proc p, lateral aclexplode(p.proacl) a where p.oid=$1::regprocedure and a.grantee=0",[signature])).rows[0].n,0);
      assert.equal((await db.query("select has_function_privilege($1,$2,'EXECUTE') allowed",[fn.owner,signature])).rows[0].allowed,true);
    }
  });
  it("grant hardening is repeatable and preserves data, all policies, table definitions and function security",async()=>{
    await db.exec("reset role");
    const snapshot=async()=>{
      const tables=(await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows;
      const data=[];
      for(const {tablename} of tables) data.push((await db.query(`select to_jsonb(t) row from public."${tablename}" t order by to_jsonb(t)::text`)).rows);
      return {data,policies:(await db.query("select * from pg_policies where schemaname='public' order by tablename,policyname")).rows,
        columns:(await db.query("select * from information_schema.columns where table_schema='public' order by table_name,ordinal_position")).rows,
        functions:(await db.query("select proname,proowner,prosecdef,proconfig,prosrc from pg_proc where pronamespace='public'::regnamespace order by oid")).rows};
    };
    await db.exec("grant execute on function public.social_account_targets(), public.social_account_target_active(uuid) to public, anon, service_role");
    const before=await snapshot();
    const migration=await readFile(new URL('../supabase/migrations/202609140003_social_function_grants.sql',import.meta.url),'utf8');
    await db.exec(migration);await db.exec(migration);
    assert.deepEqual(await snapshot(),before);
  });
  it("adds the LDG collection idempotently without changing existing taxonomy or links",async()=>{
    await db.exec("reset role");
    const before=(await db.query("select * from public.reference_collections order by id")).rows;
    const links=(await db.query("select * from public.link_items order by id")).rows;
    assert.equal(before.filter(row=>row.parent_id===null).length,10);
    assert.equal(before.filter(row=>row.parent_id!==null).length,3);
    for(const expected of referenceCollections){
      const actual=before.find(row=>row.id===expected.id);
      assert.deepEqual({id:actual.id,name:actual.name,description:actual.description,parent_id:actual.parent_id},expected);
    }
    const added=before.find(row=>row.id==="ldg-ldge-documents");
    assert.equal(added.depth,0); assert.equal(added.parent_depth,null);
    await db.exec(await readFile(new URL("../supabase/migrations/202609130002_ldg_documents_collection.sql",import.meta.url),"utf8"));
    assert.deepEqual((await db.query("select * from public.reference_collections order by id")).rows,before);
    assert.deepEqual((await db.query("select * from public.link_items order by id")).rows,links);
    await as("viewer");
    assert.equal((await db.query("select id from public.reference_collections where id='ldg-ldge-documents'")).rows.length,1);
  });
  it("backfills dates without losing legacy records or editability",async()=>{
    await as("admin");
    const row=(await db.query("select * from public.link_items where id=$1",[legacyId])).rows[0];
    const exact=(await db.query("select created_at = '2020-01-01T12:30:00.123456Z'::timestamptz as created_preserved, updated_at = '2021-02-03T04:05:06.654321Z'::timestamptz as updated_preserved, date_added = created_at as date_preserved from public.link_items where id=$1",[legacyId])).rows[0];
    assert.deepEqual(exact,{created_preserved:true,updated_preserved:true,date_preserved:true});
    assert.equal(row.collection_id,"drafting");
    await db.query("update public.link_items set label='Legacy edited' where id=$1",[legacyId]);
    assert.equal((await db.query("select label from public.link_items where id=$1",[legacyId])).rows[0].label,"Legacy edited");
    assert.deepEqual((await db.query("select updated_at > '2021-02-03T04:05:06.654321Z'::timestamptz as advanced, date_added = created_at as preserved from public.link_items where id=$1",[legacyId])).rows[0],{advanced:true,preserved:true});
  });
  it("enforces one nesting level and matching collection/subcollection in PostgreSQL",async()=>{
    await as("admin");
    await db.query("update public.link_items set collection_id='control-systems',subcollection_id='consoles' where id=$1",[legacyId]);
    await assert.rejects(()=>db.query("update public.link_items set collection_id='drafting' where id=$1",[legacyId]));
    await assert.rejects(()=>db.query("update public.link_items set collection_id='consoles',subcollection_id=null where id=$1",[legacyId]));
    await db.exec("reset role");
    await assert.rejects(()=>db.exec("insert into public.reference_collections values('too-deep','Deep','No','consoles',1,0)"));
  });
  it("rejects NULL hierarchy bypasses while allowing a root and one child",async()=>{
    await db.exec("reset role");
    await db.exec("insert into public.reference_collections values('test-root','Root','Test',null,0,null),('test-child','Child','Test','test-root',1,0)");
    for (const [parent,depth,parentDepth] of [["test-root",1,null],["test-root",1,1],["test-child",1,null],["test-child",1,0],["test-child",2,1],[null,1,0],["test-root",0,null]]) {
      await assert.rejects(()=>db.query("insert into public.reference_collections values('invalid-child','Invalid','Test',$1,$2,$3)",[parent,depth,parentDepth]));
    }
  });
  it("preserves publication rules and filters collection counts/search through RLS",async()=>{
    await as("contributor");
    await assert.rejects(()=>db.query("insert into public.link_items(label,url,status,created_by) values('Forbidden','https://public.com','published',$1)",[ids.contributor]));
    await db.query("insert into public.link_items(label,url,description,status,created_by) values('Private draft','https://public.com','draftneedle','draft',$1)",[ids.contributor]);
    await as("viewer");
    assert.equal((await db.query("select * from public.search_references('draftneedle')")).rows.length,0);
    assert.equal((await db.query("select * from public.search_references('Consoles')")).rows.length,1);
    await assert.rejects(()=>db.query("insert into public.link_items(label,url,created_by) values('Bad','https://public.com',$1)",[ids.viewer]));
    await as("pending");
    assert.equal((await db.query("select * from public.search_references('')")).rows.length,0);
    assert.equal((await db.query("select * from public.reference_collections")).rows.length,0);
  });
  it("imports atomically and idempotently while retaining source dates, tags, revisions and later edits",async()=>{
    await as("admin");
    let result=await db.query("select * from public.import_notion_references($1)",[JSON.stringify(manifest)]);
    assert.equal(result.rows[0].outcome,"imported");
    await db.exec("update public.link_items set label='Human edit' where import_source is not null");
    result=await db.query("select * from public.import_notion_references($1)",[JSON.stringify(manifest)]);
    assert.equal(result.rows[0].outcome,"already_imported");
    const row=(await db.query("select * from public.link_items where import_source=$1",[manifest[0].import_source])).rows[0];
    assert.equal(row.label,"Human edit"); assert.equal(row.status,"draft");
    assert.equal(row.link_health,"redirected"); assert.equal(row.final_url,manifest[0].final_url);
    assert.equal(new Date(row.date_added).toISOString(),"2022-03-04T10:30:00.000Z");
    assert.equal((await db.query("select * from public.revision_notes where entity_id=$1",[row.id])).rows.length,1);
    assert.equal((await db.query("select * from public.search_references('console')")).rows.length,2);
    for (const needle of ["Human edit","Lighting maker","Old source","etcconnect.com"]) {
      assert.equal((await db.query("select * from public.search_references($1)",[needle])).rows.length,1);
    }
    await assert.rejects(()=>db.query("select * from public.import_notion_references($1)",[JSON.stringify([{...manifest[0],import_source:"notion:bbbbbbbbbbbb4bbb8bbbbbbbbbbbbbbb"},{...manifest[0],import_source:"bad"}])]));
    assert.equal((await db.query("select * from public.link_items where import_source='notion:bbbbbbbbbbbb4bbb8bbbbbbbbbbbbbbb'")).rows.length,0);
    await as("editor");
    await assert.rejects(()=>db.query("select * from public.import_notion_references($1)",[JSON.stringify(manifest)]));
  });
  it("restricts non-admin social mutations to the owning active profile and exposes only public identity",async()=>{
    await as("viewer");
    await db.query("insert into public.profile_social_links(profile_id,label,url) values($1,'Portfolio','https://public.com')",[ids.viewer]);
    await assert.rejects(()=>db.query("insert into public.profile_social_links(profile_id,label,url) values($1,'Impersonation','https://public.com')",[ids.admin]));
    await as("contributor");
    assert.equal((await db.query("update public.profile_social_links set label='Hijack' returning id")).rows.length,0);
    const rows=(await db.query("select * from public.social_directory()")).rows;
    assert.equal(rows.length,1); assert.deepEqual(Object.keys(rows[0]).sort(),["display_name","id","label","profile_id","url"].sort());
    await as("pending"); assert.equal((await db.query("select * from public.social_directory()")).rows.length,0);
  });
  it("persists Unicode boundary metadata and imports failed enrichment without losing references",async()=>{
    await as("admin");
    const metadata=await checkReference("https://public.com",{
      resolve:async()=>[{address:"93.184.216.34",family:4}],
      request:async()=>({status:200,headers:{"content-type":"text/html"},body:Buffer.from('<title>'+"a".repeat(499)+'😀</title><meta property="og:site_name" content="'+"b".repeat(199)+'😀&#xD800;\0">')}),
    });
    await db.query("select $1::jsonb",[JSON.stringify(metadata)]);
    await db.query("update public.link_items set fetched_title=$1,site_name=$2 where id=$3",[metadata.fetched_title,metadata.site_name,legacyId]);
    const failed=await checkReference("https://public.com",{resolve:async()=>{throw new Error("DNS failed");},request:async()=>assert.fail("No request after DNS failure")});
    const batch=[{...manifest[0],...metadata,import_source:"notion:cccccccccccc4ccc8ccccccccccccccc"},{...manifest[0],...failed,import_source:"notion:dddddddddddd4ddd8ddddddddddddddd"}];
    const results=(await db.query("select * from public.import_notion_references($1)",[JSON.stringify(batch)])).rows;
    assert.deepEqual(results.map(r=>r.outcome),["imported","imported"]);
    assert.equal((await db.query("select link_health from public.link_items where import_source=$1",[batch[1].import_source])).rows[0].link_health,"could_not_verify");
  });
  it("allows repeated platforms, owner CRUD and admin CRUD for active members without exposing private fields",async()=>{
    await as("viewer");
    const created=[];
    for(const label of ["Instagram","TikTok","Personal Website"])for(let i=0;i<2;i++){
      created.push((await db.query("insert into public.profile_social_links(profile_id,label,url) values($1,$2,$3) returning id",[ids.viewer,label,`https://example.com/${label.replaceAll(' ','')}/${i}`])).rows[0].id);
    }
    assert.equal(created.length,6);
    assert.equal((await db.query("update public.profile_social_links set label='Owner edit' where id=$1 returning id",[created[0]])).rows.length,1);
    assert.equal((await db.query("delete from public.profile_social_links where id=$1 returning id",[created[0]])).rows.length,1);
    assert.equal((await db.query("select * from public.social_account_targets()")).rows.length,0);
    await as("contributor");
    assert.equal((await db.query("delete from public.profile_social_links where id=$1 returning id",[created[1]])).rows.length,0);
    assert.equal((await db.query("update public.profile_social_links set label='No' where id=$1 returning id",[created[1]])).rows.length,0);
    assert.equal((await db.query("select * from public.profiles where id=$1",[ids.viewer])).rows.length,0);
    await as("admin");
    const targets=(await db.query("select * from public.social_account_targets()")).rows;
    assert.equal(targets.length,4);assert.deepEqual(Object.keys(targets[0]).sort(),["display_name","profile_id"]);
    assert.ok(!targets.some(row=>row.profile_id===ids.pending));
    const added=(await db.query("insert into public.profile_social_links(profile_id,label,url) values($1,'Instagram','https://www.instagram.com/adminadded/') returning id",[ids.viewer])).rows[0].id;
    assert.equal((await db.query("update public.profile_social_links set url='https://www.instagram.com/corrected/' where id=$1 returning id",[added])).rows.length,1);
    assert.equal((await db.query("delete from public.profile_social_links where id=$1 returning id",[added])).rows.length,1);
    await assert.rejects(()=>db.query("insert into public.profile_social_links(profile_id,label,url) values($1,'Instagram','https://example.com')",[ids.pending]));
    assert.equal((await db.query("select * from public.profile_social_links where id=any($1::uuid[])",[created.slice(1)])).rows.length,5);
    await as("pending");
    await assert.rejects(()=>db.query("insert into public.profile_social_links(profile_id,label,url) values($1,'Instagram','https://example.com')",[ids.pending]));
    assert.equal((await db.query("select * from public.social_directory()")).rows.length,0);
  });
});
